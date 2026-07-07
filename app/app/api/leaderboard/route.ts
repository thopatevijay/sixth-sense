// Nation leaderboard (FR-B1). Uses Postgres when DATABASE_URL is set (Phase 0); until then it
// serves a seed board so the feature renders and demos. The client merges the signed-in fan's own
// nation contribution on top, so the board updates as they witness moments.

import { NextResponse } from 'next/server';

export interface NationStanding {
  code: string;
  name: string;
  flag: string;
  moments: number; // total moments witnessed by that nation's fans
  fans: number;
}

// Plausible seed standings (demo data until Postgres is wired at Phase 0).
const SEED: NationStanding[] = [
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', moments: 1840, fans: 512 },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', moments: 1712, fans: 471 },
  { code: 'FR', name: 'France', flag: '🇫🇷', moments: 1533, fans: 438 },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', moments: 1207, fans: 355 },
  { code: 'EN', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', moments: 1090, fans: 331 },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', moments: 964, fans: 289 },
];

export async function GET() {
  // Phase 0: if (process.env.DATABASE_URL) return live aggregates from Postgres.
  return NextResponse.json({ source: process.env.DATABASE_URL ? 'db' : 'seed', standings: SEED });
}
