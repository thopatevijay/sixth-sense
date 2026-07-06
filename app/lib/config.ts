// App-wide constants. The demo fixture + default relay mode.

import type { RelayMode } from './relay';

/** Portugal v Spain from the de-risk capture; any fixtureId works with MOCK/REPLAY. */
export const DEMO_FIXTURE_ID = 18198205;

/** Deployed default is replay (FR-D1); dev default is mock so it runs with no services. */
export const DEFAULT_MODE: RelayMode =
  (process.env.NEXT_PUBLIC_RELAY_MODE as RelayMode) || 'mock';

export const PARTICIPANTS = {
  1: { name: 'France', short: 'FRA', flag: '🇫🇷' },
  2: { name: 'Brazil', short: 'BRA', flag: '🇧🇷' },
} as const;
