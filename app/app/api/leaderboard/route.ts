// Nation leaderboard (FR-B1). Reads/writes Postgres when DATABASE_URL is set; otherwise serves a
// seed board so the feature still renders. GET → standings; POST → record a witnessed moment.

import { NextResponse } from 'next/server';
import { getPool, hasDb } from '@/lib/db';

export const runtime = 'nodejs';

export interface NationStanding {
  code: string;
  name: string;
  flag: string;
  moments: number;
  fans: number;
}

// Seed standings (used only when no DATABASE_URL) — mirrors the DB seed.
const SEED: NationStanding[] = [
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', moments: 1840, fans: 512 },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', moments: 1712, fans: 471 },
  { code: 'FR', name: 'France', flag: '🇫🇷', moments: 1533, fans: 438 },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', moments: 1207, fans: 355 },
  { code: 'EN', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', moments: 1090, fans: 331 },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', moments: 964, fans: 289 },
];

export async function GET() {
  if (!hasDb()) return NextResponse.json({ source: 'seed', standings: SEED });
  try {
    const { rows } = await getPool().query<NationStanding>(
      'SELECT code, name, flag, moments, fans FROM nation_standings ORDER BY moments DESC',
    );
    return NextResponse.json({ source: 'db', standings: rows });
  } catch {
    return NextResponse.json({ source: 'seed', standings: SEED });
  }
}

interface WitnessBody {
  code?: string;
  name?: string;
  flag?: string;
  wallet?: string | null;
  fixtureId?: number;
  kind?: string;
  player?: string;
  clock?: number;
}

export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ ok: false, reason: 'no-db' });
  const b = (await req.json().catch(() => ({}))) as WitnessBody;
  if (!b.code || !b.name || !b.flag) {
    return NextResponse.json({ ok: false, reason: 'bad-request' }, { status: 400 });
  }
  try {
    const pool = getPool();
    await pool.query(
      `INSERT INTO nation_standings (code, name, flag, moments, fans) VALUES ($1,$2,$3,1,1)
       ON CONFLICT (code) DO UPDATE SET moments = nation_standings.moments + 1`,
      [b.code, b.name, b.flag],
    );
    await pool.query(
      `INSERT INTO witnessed (wallet, nation_code, fixture_id, lookup_kind, player_name, clock)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [b.wallet ?? null, b.code, b.fixtureId ?? null, b.kind ?? null, b.player ?? null, b.clock ?? null],
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, reason: 'db-error' }, { status: 500 });
  }
}
