'use client';

import { useAuth } from '../lib/auth';
import { useNation } from '../lib/nation';
import { useRelay } from '../lib/relay';
import { DEFAULT_MODE, DEMO_FIXTURE_ID, PARTICIPANTS } from '../lib/config';

// Phase 2 SURGE home: a signed-in user watching live/replayed/mock ticks arrive.
// Deliberately MVP — Phase 3 adds interpolation/haptics, Phase 4 the LOOK-UP hero.
export function SurgeHome() {
  const { logout, walletAddress } = useAuth();
  const { nation, clearNation } = useNation();
  const { status, surge, lookup, score, tickCount } = useRelay(DEMO_FIXTURE_ID, DEFAULT_MODE);

  const p1 = surge?.p1Pct ?? 0.5;
  const p2 = surge?.p2Pct ?? 0.5;
  const total = p1 + p2 || 1;
  const p1Width = (p1 / total) * 100;
  const leader = p1 === p2 ? null : p1 > p2 ? 1 : 2;
  const leaderName = leader ? PARTICIPANTS[leader].name : null;

  return (
    <main className="min-h-dvh flex flex-col px-5 py-4 gap-6">
      {/* header */}
      <header className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <span className="text-lg">{nation?.flag ?? '🌍'}</span>
          <span className="text-neutral-400">{nation?.name ?? 'World'}</span>
        </span>
        <span className="flex items-center gap-2">
          <StatusDot status={status} />
          <button onClick={() => { clearNation(); logout(); }} className="text-neutral-500 hover:text-neutral-300">
            sign out
          </button>
        </span>
      </header>

      {/* scoreline */}
      <div className="flex items-center justify-center gap-4 text-2xl font-bold">
        <span>{PARTICIPANTS[1].flag} {PARTICIPANTS[1].short}</span>
        <span className="tabular-nums text-3xl">{score.p1}–{score.p2}</span>
        <span>{PARTICIPANTS[2].short} {PARTICIPANTS[2].flag}</span>
      </div>

      {/* SURGE bar */}
      <div className="flex-1 flex flex-col justify-center gap-4">
        <div className="relative h-14 rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-700 to-blue-500 transition-[width] duration-500 ease-out"
            style={{ width: `${p1Width}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-gradient-to-l from-red-700 to-red-500 transition-[width] duration-500 ease-out"
            style={{ width: `${100 - p1Width}%` }}
          />
        </div>
        <p className="text-center text-neutral-300 min-h-6">
          {leaderName ? (
            <span className="font-semibold">{leaderName} surging</span>
          ) : (
            <span className="text-neutral-500">Level game</span>
          )}
          {surge?.possessionType && surge.possessionType !== 'Safe' && (
            <span className="text-amber-400"> · {surge.possessionType}</span>
          )}
        </p>
      </div>

      {/* LOOK-UP banner (basic; the hero interrupt comes in Phase 4) */}
      {lookup && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-center text-amber-300">
          ⚡ Look up — {lookup.playerName ?? PARTICIPANTS[lookup.side ?? 1].name} · {lookup.kind} incoming
        </div>
      )}

      {/* footer: proves ticks arriving + wallet exists (Gate 2) */}
      <footer className="text-center text-[11px] text-neutral-600 space-y-0.5">
        <div>{tickCount} ticks · {DEFAULT_MODE} · clock {formatClock(surge?.clock ?? 0)}</div>
        {walletAddress && <div className="truncate">wallet {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</div>}
      </footer>
    </main>
  );
}

function StatusDot({ status }: { status: 'connecting' | 'live' | 'reconnecting' }) {
  const color = status === 'live' ? 'bg-green-500' : status === 'reconnecting' ? 'bg-amber-500' : 'bg-neutral-500';
  return (
    <span className="flex items-center gap-1.5 text-neutral-500">
      <span className={`h-2 w-2 rounded-full ${color} ${status === 'live' ? 'animate-pulse' : ''}`} />
      {status}
    </span>
  );
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}'${s.toString().padStart(2, '0')}`;
}
