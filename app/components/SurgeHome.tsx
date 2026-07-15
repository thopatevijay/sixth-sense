'use client';

import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useNation } from '../lib/nation';
import { useRelay } from '../lib/relay';
import { useMomentTracker } from '../lib/moment';
import { DEFAULT_MODE, DEMO_FIXTURE_ID, PARTICIPANTS } from '../lib/config';
import { SurgeBar } from './SurgeBar';
import { LookUpLayer } from './LookUp';
import { MomentSheet } from './Moment';
import { Leaderboard } from './Leaderboard';

// SURGE home: the live loop — momentum bar, LOOK-UP hero, and the shareable Moment.
export function SurgeHome() {
  const { logout, walletAddress } = useAuth();
  const { nation, clearNation } = useNation();
  const { status, surge, lookup, lastEvent, score, tickCount } = useRelay(DEMO_FIXTURE_ID, DEFAULT_MODE);
  const { moment, standout } = useMomentTracker(surge, lastEvent, nation);
  const [showMoment, setShowMoment] = useState(false);
  const [showBoard, setShowBoard] = useState(false);

  return (
    <main className="min-h-dvh flex flex-col px-5 py-4 gap-6">
      {/* header */}
      <header className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <span className="text-lg">{nation?.flag ?? '🌍'}</span>
          <span className="text-neutral-400">{nation?.name ?? 'World'}</span>
        </span>
        <span className="flex items-center gap-3">
          <StatusDot status={status} mode={DEFAULT_MODE} />
          <button onClick={() => setShowBoard(true)} className="text-neutral-500 hover:text-neutral-300" aria-label="Nations">
            🏆
          </button>
          <button onClick={() => { clearNation(); logout(); }} className="text-neutral-500 hover:text-neutral-300">
            sign out
          </button>
        </span>
      </header>

      {/* transparent reconnect — the loop survives a network blip (NFR-2) */}
      {status === 'reconnecting' && (
        <div className="mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs text-amber-300">
          reconnecting…
        </div>
      )}

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

      {/* Your Moment — pulses when a standout swing makes it worth keeping */}
      <button
        onClick={() => setShowMoment(true)}
        className={`mx-auto rounded-full px-5 py-2.5 text-sm font-medium border transition active:scale-[.97] ${
          standout
            ? 'border-amber-500/60 bg-amber-500/10 text-amber-300 animate-pulse'
            : 'border-neutral-800 text-neutral-400'
        }`}
      >
        ✨ Your Moment · Lvl {moment.level}
      </button>

      {/* LOOK-UP hero — full-screen interrupt + resolution */}
      <LookUpLayer lookup={lookup} lastEvent={lastEvent} />

      {showMoment && (
        <MomentSheet moment={moment} walletAddress={walletAddress} onClose={() => setShowMoment(false)} />
      )}
      {showBoard && (
        <Leaderboard nation={nation} myMoments={moment.witnessedGoals} onClose={() => setShowBoard(false)} />
      )}

      {/* footer: proves ticks arriving + wallet exists */}
      <footer className="text-center text-[11px] text-neutral-600 space-y-0.5">
        <div>{tickCount} ticks · {DEFAULT_MODE} · clock {formatClock(surge?.clock ?? 0)}</div>
        {walletAddress && <div className="truncate">wallet {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</div>}
      </footer>
    </main>
  );
}

function StatusDot({ status, mode }: { status: 'connecting' | 'live' | 'reconnecting'; mode: string }) {
  const connected = status === 'live';
  const color = connected ? 'bg-green-500' : status === 'reconnecting' ? 'bg-amber-500' : 'bg-neutral-500';
  // The dot shows connection health; the label shows the DATA MODE, so a replay demo
  // never mislabels itself as a live match. Only a true live feed pulses + reads "live".
  const label = status === 'connecting' ? 'connecting' : status === 'reconnecting' ? 'reconnecting' : mode;
  return (
    <span className="flex items-center gap-1.5 text-neutral-500">
      <span className={`h-2 w-2 rounded-full ${color} ${connected && mode === 'live' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}'${s.toString().padStart(2, '0')}`;
}
