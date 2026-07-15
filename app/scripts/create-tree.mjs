// One-time: create a Bubblegum Merkle tree on devnet for SIXTH SENSE Moment cNFTs.
// Run once; paste the printed tree address into BUBBLEGUM_TREE_ADDRESS.
//   node scripts/create-tree.mjs
// Reads HELIUS_RPC_URL + FEE_PAYER_KEYPAIR from .env.local.

import fs from 'node:fs';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createTree, mplBubblegum } from '@metaplex-foundation/mpl-bubblegum';
import { generateSigner, keypairIdentity } from '@metaplex-foundation/umi';

// minimal .env.local loader
for (const line of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const RPC = process.env.HELIUS_RPC_URL;
const KEYPAIR = process.env.FEE_PAYER_KEYPAIR;
if (!RPC || !KEYPAIR) throw new Error('need HELIUS_RPC_URL + FEE_PAYER_KEYPAIR in .env.local');

const umi = createUmi(RPC).use(mplBubblegum());
const secret = new Uint8Array(JSON.parse(fs.readFileSync(KEYPAIR.replace('~', process.env.HOME), 'utf8')));
umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(secret)));
console.log('fee-payer:', umi.identity.publicKey);

const merkleTree = generateSigner(umi);
console.log('creating tree', merkleTree.publicKey, '…');
const builder = await createTree(umi, { merkleTree, maxDepth: 14, maxBufferSize: 64, public: false });
await builder.sendAndConfirm(umi);

console.log('\n✅ TREE CREATED');
console.log('BUBBLEGUM_TREE_ADDRESS=' + merkleTree.publicKey);
