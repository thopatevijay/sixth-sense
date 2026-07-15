// App-wide constants. The demo fixture + default relay mode.

import type { RelayMode } from './relay';

/** Real captured semifinal (Argentina comeback 0–2 → 3–2 vs Egypt) — our demo replay
 *  asset `replay-18202701.jsonl`. Any fixtureId works with MOCK. */
export const DEMO_FIXTURE_ID = 18202701;

/** Deployed default is replay (FR-D1); dev default is mock so it runs with no services. */
export const DEFAULT_MODE: RelayMode =
  (process.env.NEXT_PUBLIC_RELAY_MODE as RelayMode) || 'mock';

/** Participant1 / Participant2 of the demo fixture. */
export const PARTICIPANTS = {
  1: { name: 'Argentina', short: 'ARG', flag: '🇦🇷' },
  2: { name: 'Egypt', short: 'EGY', flag: '🇪🇬' },
} as const;

/** Fallback star player per side when a LOOK-UP arrives without a named player. */
export const STAR_PLAYER = { 1: 'Messi', 2: 'Salah' } as const;
