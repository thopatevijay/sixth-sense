'use client';

// Nation leaderboard sheet (FR-B1/B2). Diaspora framing: your team, ranked by the moments its
// fans have witnessed worldwide. Loading / error / empty states all look intentional (NFR-2).

import { useLeaderboard } from '../lib/leaderboard';
import type { Nation } from '../lib/nation';

interface Props {
  nation: Nation | null;
  myMoments: number;
  onClose: () => void;
}

export function Leaderboard({ nation, myMoments, onClose }: Props) {
  const { standings, source, loading, error } = useLeaderboard(nation, myMoments);

  return (
    <div className="fixed inset-0 z-[55] bg-neutral-950/95 backdrop-blur flex flex-col px-6 py-8 overflow-y-auto">
      <button onClick={onClose} className="absolute top-4 right-5 text-neutral-500 hover:text-neutral-200 text-2xl">×</button>

      <h2 className="text-2xl font-bold text-center mb-1">Nations</h2>
      <p className="text-center text-neutral-500 text-sm mb-6">Moments witnessed by fans worldwide</p>

      {loading && (
        <div className="space-y-2 max-w-sm w-full mx-auto">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-neutral-900 animate-pulse" />
          ))}
        </div>
      )}

      {error && !loading && (
        <p className="text-center text-neutral-500 mt-10">Couldn&apos;t load the board. Pull to retry.</p>
      )}

      {!loading && !error && (
        <ol className="space-y-2 max-w-sm w-full mx-auto">
          {standings.map((s, i) => (
            <li
              key={s.code}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                s.you ? 'border-blue-500/50 bg-blue-500/10' : 'border-neutral-800 bg-neutral-900/50'
              }`}
            >
              <span className="w-6 text-center text-neutral-500 tabular-nums">{i + 1}</span>
              <span className="text-2xl">{s.flag}</span>
              <span className="flex-1 font-medium">
                {s.name}
                {s.you && <span className="ml-2 text-xs text-blue-400">you</span>}
              </span>
              <span className="tabular-nums text-neutral-300">{s.moments.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}

      {source === 'seed' && !loading && !error && (
        <p className="text-center text-neutral-600 text-[11px] mt-6">demo standings · live totals when the database is connected</p>
      )}
    </div>
  );
}
