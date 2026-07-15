'use client';

// Nation/team pick, persisted to localStorage so it survives reload (FR-A3 AC) and stays in
// sync across every screen (via the shared store).

import { useCallback, useMemo } from 'react';
import { usePersistentRaw } from './store';

export interface Nation {
  code: string;
  name: string;
  flag: string;
  /** Which participant this nation maps to in the demo fixture (SURGE lean). */
  side: 1 | 2;
}

// Demo fixture is Argentina (P1) vs Egypt (P2) — follow your team in the live match.
export const NATIONS: Nation[] = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', side: 1 },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', side: 2 },
];

const KEY = 'sixthsense.nation';

export function useNation() {
  const { value, set, mounted } = usePersistentRaw(KEY);

  const nation = useMemo<Nation | null>(() => {
    if (!value) return null;
    try {
      const n = JSON.parse(value) as Nation;
      // Drop a stale pick that isn't a team in the current fixture (forces a fresh, aligned pick).
      return NATIONS.some((x) => x.code === n.code) ? n : null;
    } catch {
      return null;
    }
  }, [value]);

  const setNation = useCallback((n: Nation) => set(JSON.stringify(n)), [set]);
  const clearNation = useCallback(() => set(null), [set]);

  return { nation, setNation, clearNation, loaded: mounted };
}
