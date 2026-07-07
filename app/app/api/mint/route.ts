// Server route for the Moment cNFT. The fee-payer key + Helius RPC live here only (NFR-3).
//
// Gasless flow (activated at Phase 0 once the env below is set):
//   1. umi + fee-payer signer (FEE_PAYER_KEYPAIR) on HELIUS_RPC_URL.
//   2. First moment  → mintV2 an evolving Bubblegum cNFT to the user's wallet on BUBBLEGUM_TREE_ADDRESS.
//   3. Later moments → update metadata (level/rarity) — the one collectible evolves (FR-M2).
//   4. verified stamp is backed by TxLINE /api/scores/stat-validation + Anchor validateStat (FR-M3).
//
// Until those env vars exist we return 'unconfigured' so the client shows the share card without
// any (false) chain claim (FR-M5). No secret is ever sent to the browser.

import { NextResponse } from 'next/server';

interface MintRequest {
  moment?: { level?: number };
  walletAddress?: string | null;
}

function configured(): boolean {
  return Boolean(process.env.HELIUS_RPC_URL && process.env.FEE_PAYER_KEYPAIR && process.env.BUBBLEGUM_TREE_ADDRESS);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as MintRequest;

  if (!configured()) {
    return NextResponse.json({
      status: 'unconfigured',
      verified: false,
      message: 'Minting not configured yet — the shareable card still works.',
    });
  }

  if (!body.walletAddress) {
    return NextResponse.json({ status: 'error', verified: false, message: 'no wallet' }, { status: 400 });
  }

  // Phase 0: mint/level via umi + mpl-bubblegum here, then return the real assetId.
  // Kept behind the env guard so we never ship an untested or faked mint.
  return NextResponse.json({
    status: 'error',
    verified: false,
    message: 'mint implementation pending Phase 0 wiring',
  });
}
