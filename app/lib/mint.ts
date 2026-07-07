'use client';

// Client half of the Moment mint. Talks to the server route (fee-payer key stays server-side,
// NFR-3). Degrades gracefully: an 'unconfigured'/'error' result still leaves the share card fully
// usable and never claims chain verification (FR-M5).

import type { Moment } from './moment';

export type MintStatus = 'minted' | 'leveled' | 'unconfigured' | 'error';

export interface MintResult {
  status: MintStatus;
  verified: boolean;
  assetId?: string | null;
  message?: string;
}

export async function mintMoment(moment: Moment, walletAddress: string | null): Promise<MintResult> {
  try {
    const res = await fetch('/api/mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moment, walletAddress }),
    });
    const data = (await res.json()) as MintResult;
    return { ...data, verified: data.status === 'minted' || data.status === 'leveled' };
  } catch {
    return { status: 'error', verified: false, message: 'mint request failed' };
  }
}
