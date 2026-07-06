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

// Demo fixture is France (P1) vs Brazil (P2) — matches the MOCK hero-arc players.
export const NATIONS: Nation[] = [
  { code: 'FR', name: 'France', flag: '🇫🇷', side: 1 },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', side: 2 },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', side: 1 },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', side: 2 },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', side: 1 },
  { code: 'EN', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', side: 2 },
];

const KEY = 'sixthsense.nation';

export function useNation() {
  const { value, set, mounted } = usePersistentRaw(KEY);

  const nation = useMemo<Nation | null>(() => {
    if (!value) return null;
    try {
      return JSON.parse(value) as Nation;
    } catch {
      return null;
    }
  }, [value]);

  const setNation = useCallback((n: Nation) => set(JSON.stringify(n)), [set]);
  const clearNation = useCallback(() => set(null), [set]);

  return { nation, setNation, clearNation, loaded: mounted };
}
