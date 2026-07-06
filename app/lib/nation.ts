'use client';

// Nation/team pick, persisted to localStorage so it survives reload (FR-A3 AC).

import { useCallback, useEffect, useState } from 'react';

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
  const [nation, setNationState] = useState<Nation | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try {
        setNationState(JSON.parse(raw) as Nation);
      } catch {
        /* ignore corrupt value */
      }
    }
    setLoaded(true);
  }, []);

  const setNation = useCallback((n: Nation) => {
    localStorage.setItem(KEY, JSON.stringify(n));
    setNationState(n);
  }, []);

  const clearNation = useCallback(() => {
    localStorage.removeItem(KEY);
    setNationState(null);
  }, []);

  return { nation, setNation, clearNation, loaded };
}
