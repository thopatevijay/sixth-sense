'use client';

import { useAuth } from '../lib/auth';
import { useNation } from '../lib/nation';
import { useRelay } from '../lib/relay';
import { DEFAULT_MODE, DEMO_FIXTURE_ID, PARTICIPANTS } from '../lib/config';
import { SurgeBar } from './SurgeBar';
import { LookUpLayer } from './LookUp';

// Phase 2 SURGE home: a signed-in user watching live/replayed/mock ticks arrive.
// Deliberately MVP — Phase 3 adds interpolation/haptics, Phase 4 the LOOK-UP hero.
export function SurgeHome() {
  const { logout, walletAddress } = useAuth();
  const { nation, clearNation } = useNation();
  const { status, surge, lookup, lastEvent, score, tickCount } = useRelay(DEMO_FIXTURE_ID, DEFAULT_MODE);

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

      {/* SURGE bar — self-animating (interpolation + micro-motion + swing feedback) */}
      <div className="flex-1 flex flex-col justify-center">
        <SurgeBar tick={surge} names={{ 1: PARTICIPANTS[1].name, 2: PARTICIPANTS[2].name }} />
      </div>

      {/* LOOK-UP hero — full-screen interrupt + resolution */}
      <LookUpLayer lookup={lookup} lastEvent={lastEvent} />

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
