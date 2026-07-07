'use client';

// Fetches nation standings and merges the signed-in fan's own contribution so the board
// reflects the moments they've witnessed this session (FR-B1 "updates after a new moment").

import { useEffect, useMemo, useState } from 'react';
import type { Nation } from './nation';

export interface NationStanding {
  code: string;
  name: string;
  flag: string;
  moments: number;
  fans: number;
  you?: boolean;
}

interface State {
  standings: NationStanding[];
  source: 'db' | 'seed' | null;
  loading: boolean;
  error: boolean;
}

export function useLeaderboard(nation: Nation | null, myMoments: number): State {
  const [raw, setRaw] = useState<{ standings: NationStanding[]; source: 'db' | 'seed' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => alive && (setRaw(d), setError(false)))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const standings = useMemo<NationStanding[]>(() => {
    if (!raw) return [];
    const list = raw.standings.map((s) => ({ ...s }));
    if (nation) {
      const mine = list.find((s) => s.code === nation.code);
      if (mine) {
        mine.moments += myMoments;
        mine.you = true;
      } else {
        list.push({ code: nation.code, name: nation.name, flag: nation.flag, moments: myMoments, fans: 1, you: true });
      }
    }
    return list.sort((a, b) => b.moments - a.moments);
  }, [raw, nation, myMoments]);

  return { standings, source: raw?.source ?? null, loading, error };
}
