// Server route for the Moment cNFT. Fee-payer key + RPC live here only (NFR-3).
// Configured (Phase 0 done): mints a gasless Bubblegum cNFT owned by the user's wallet.
// Unconfigured: returns 'unconfigured' so the client shows the share card with no chain claim (FR-M5).

import { NextResponse } from 'next/server';
import { mintConfigured, mintMomentCNFT } from '@/lib/mintServer';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface MintRequest {
  moment?: { level?: number; rarity?: string };
  walletAddress?: string | null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as MintRequest;

  if (!mintConfigured()) {
    return NextResponse.json({
      status: 'unconfigured',
      verified: false,
      message: 'Minting not configured yet — the shareable card still works.',
    });
  }
  if (!body.walletAddress) {
    return NextResponse.json({ status: 'error', verified: false, message: 'no wallet' }, { status: 400 });
  }

  try {
    const { assetId, signature } = await mintMomentCNFT({
      owner: body.walletAddress,
      level: body.moment?.level ?? 1,
      rarity: body.moment?.rarity ?? 'Common',
    });
    return NextResponse.json({ status: 'minted', verified: true, assetId, signature });
  } catch (e) {
    return NextResponse.json(
      { status: 'error', verified: false, message: (e as Error).message.slice(0, 200) },
      { status: 500 },
    );
  }
}
