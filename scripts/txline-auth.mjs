#!/usr/bin/env node
// TxLINE free-tier activation: guest JWT → on-chain `subscribe` → sign → /api/token/activate.
// Saves { network, base, jwt, apiToken } to .txline-session.json for the probe/app to reuse.
//
//   npm install
//   TX_NET=devnet  TX_KEYPAIR_PATH=~/.config/solana/id.json npm run auth   # cheap first run (60s tier)
//   TX_NET=mainnet TX_KEYPAIR_PATH=~/wallet.json            npm run auth   # real-time tier (needs mainnet SOL)
//
// Env: TX_NET (devnet|mainnet, default devnet), TX_KEYPAIR_PATH, SOLANA_RPC (optional override).

import fs from 'node:fs';
import os from 'node:os';
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  TransactionInstruction, sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import nacl from 'tweetnacl';

const NET = (process.env.TX_NET || 'devnet').toLowerCase();
const CFG = {
  devnet: {
    base: 'https://txline-dev.txodds.com',
    rpc: 'https://api.devnet.solana.com',
    programId: '6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J',
    txlMint: '4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG',
    serviceLevelId: 1,   // 60-second delay (only free tier on devnet)
  },
  mainnet: {
    base: 'https://txline.txodds.com',
    rpc: 'https://api.mainnet-beta.solana.com',
    programId: '9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA',
    txlMint: 'Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL',
    serviceLevelId: 12,  // real-time (mainnet only) — needed for the live "Pulse" feel
  },
}[NET];
if (!CFG) throw new Error(`TX_NET must be devnet|mainnet, got "${NET}"`);

const DURATION_WEEKS = 4;                 // must be a multiple of 4
const LEAGUES = [];                       // [] = standard World Cup bundle
const SUBSCRIBE_DISC = Buffer.from([254, 28, 191, 138, 156, 179, 183, 53]);

function loadKeypair() {
  const p = (process.env.TX_KEYPAIR_PATH || `${os.homedir()}/.config/solana/id.json`)
    .replace(/^~/, os.homedir());
  const secret = Uint8Array.from(JSON.parse(fs.readFileSync(p, 'utf8')));
  return Keypair.fromSecretKey(secret);
}

function u16le(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }

async function main() {
  const rpc = process.env.SOLANA_RPC || CFG.rpc;
  const conn = new Connection(rpc, 'confirmed');
  const payer = loadKeypair();
  const programId = new PublicKey(CFG.programId);
  const mint = new PublicKey(CFG.txlMint);

  console.log(`▶ network=${NET}  rpc=${rpc}\n  wallet=${payer.publicKey.toBase58()}`);
  const bal = await conn.getBalance(payer.publicKey);
  console.log(`  balance=${(bal / 1e9).toFixed(4)} SOL  (need a little for gas)`);
  if (bal === 0) throw new Error('Wallet has 0 SOL — fund it first (devnet: `solana airdrop 1 <addr> -u devnet`).');

  // Derive accounts
  const [pricingMatrix] = PublicKey.findProgramAddressSync([Buffer.from('pricing_matrix')], programId);
  const [treasuryPda] = PublicKey.findProgramAddressSync([Buffer.from('token_treasury_v2')], programId);
  const userAta = getAssociatedTokenAddressSync(mint, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const treasuryVault = getAssociatedTokenAddressSync(mint, treasuryPda, true, TOKEN_2022_PROGRAM_ID);

  // subscribe(service_level_id: u16, weeks: u8)
  const data = Buffer.concat([SUBSCRIBE_DISC, u16le(CFG.serviceLevelId), Buffer.from([DURATION_WEEKS])]);
  const keys = [
    { pubkey: payer.publicKey, isSigner: true, isWritable: true },   // user
    { pubkey: pricingMatrix, isSigner: false, isWritable: false },   // pricing_matrix
    { pubkey: mint, isSigner: false, isWritable: false },            // token_mint
    { pubkey: userAta, isSigner: false, isWritable: true },          // user_token_account
    { pubkey: treasuryVault, isSigner: false, isWritable: true },    // token_treasury_vault
    { pubkey: treasuryPda, isSigner: false, isWritable: false },     // token_treasury_pda
    { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  const subscribeIx = new TransactionInstruction({ programId, keys, data });

  // Ensure the user's TXL ATA exists (idempotent; free tier moves 0 tokens but the account is referenced)
  const ensureAta = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey, userAta, payer.publicKey, mint, TOKEN_2022_PROGRAM_ID,
  );

  console.log(`▶ sending subscribe (serviceLevelId=${CFG.serviceLevelId}, weeks=${DURATION_WEEKS}, free tier)…`);
  const tx = new Transaction().add(ensureAta, subscribeIx);
  const txSig = await sendAndConfirmTransaction(conn, tx, [payer]);
  console.log(`✅ subscribed. txSig=${txSig}`);

  // Guest JWT (used both to sign the activation message and as the Bearer)
  const jwt = (await (await fetch(`${CFG.base}/auth/guest/start`, { method: 'POST' })).json()).token;

  // Sign "${txSig}:${leagues}:${jwt}" detached with the wallet secret key
  const message = new TextEncoder().encode(`${txSig}:${LEAGUES.join(',')}:${jwt}`);
  const walletSignature = Buffer.from(nacl.sign.detached(message, payer.secretKey)).toString('base64');

  console.log('▶ activating…');
  const res = await fetch(`${CFG.base}/api/token/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ txSig, walletSignature, leagues: LEAGUES }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`activate ${res.status}: ${raw}`);
  let apiToken; try { apiToken = JSON.parse(raw).token ?? JSON.parse(raw); } catch { apiToken = raw.trim(); }
  if (typeof apiToken !== 'string') apiToken = String(apiToken);

  const session = { network: NET, base: CFG.base, jwt, apiToken, wallet: payer.publicKey.toBase58(), txSig };
  fs.writeFileSync('.txline-session.json', JSON.stringify(session, null, 2));
  console.log(`\n🎉 activated. API token: ${apiToken.slice(0, 16)}…`);
  console.log('   saved → .txline-session.json  (gitignored)');
  console.log('   next: `npm run probe:snapshot`  then set FIXTURE_ID and `npm run probe:stream`');
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
