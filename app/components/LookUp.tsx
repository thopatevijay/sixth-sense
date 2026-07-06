'use client';

// LOOK-UP hero (FR-L2..L5): a full-screen interrupt that fires BEFORE a goal/card, names a
// plausible player, then resolves against the real event as "you didn't miss it" — never
// "you were right", never any odds/bet/recommend language (FR-L4, the anti-tipster rule).
// Frequency-capped + debounced so it reads as signal, not spam (FR-L5).

import { useEffect, useRef, useState } from 'react';
import type { LookUp as LookUpEvent, MatchEvent, Side } from '../lib/relay';
import { STAR_PLAYER } from '../lib/config';
import { vibrate, playSwing } from '../lib/feedback';

interface Props {
  lookup: LookUpEvent | null;
  lastEvent: MatchEvent | null;
}

type Phase = 'incoming' | 'resolved';
interface Alert {
  id: string;
  lookup: LookUpEvent;
  phase: Phase;
  event?: MatchEvent;
}

const FREQ_CAP_MS = 8000; // min gap between alerts — anti-spam
const INCOMING_MS = 7000; // auto-dismiss if the event never lands
const RESOLVED_MS = 4500;

const lookupId = (l: LookUpEvent) => `${l.clock}:${l.kind}:${l.side}:${l.source}`;
const playerFor = (l: LookUpEvent) => l.playerName ?? STAR_PLAYER[(l.side ?? 1) as 1 | 2];

function incomingLine(kind: LookUpEvent['kind']): string {
  return { goal: 'Goal incoming', penalty: 'Penalty incoming', card: 'Card brewing', var: 'VAR incoming' }[kind];
}
function resolvedHead(kind: MatchEvent['kind']): string {
  if (kind === 'goal') return 'GOAL';
  if (kind === 'card') return 'BOOKED';
  if (kind === 'var') return 'VAR';
  if (kind === 'corner') return 'CORNER';
  return 'MOMENT';
}
// A LOOK-UP resolves against a compatible real event on the same side, after it fired.
function resolves(l: LookUpEvent, e: MatchEvent): boolean {
  if (e.clock < l.clock) return false;
  if (l.side !== null && e.side !== null && e.side !== l.side) return false;
  const map: Record<LookUpEvent['kind'], MatchEvent['kind'][]> = {
    goal: ['goal'],
    penalty: ['goal'],
    card: ['card'],
    var: ['var'],
  };
  return map[l.kind].includes(e.kind);
}

const sideColor = (side: Side) =>
  side === 2 ? 'from-red-600/30 to-red-900/60' : 'from-blue-600/30 to-blue-900/60';

export function LookUpLayer({ lookup, lastEvent }: Props) {
  const [alert, setAlert] = useState<Alert | null>(null);
  const alertRef = useRef<Alert | null>(null);
  alertRef.current = alert;
  const lastShownAt = useRef(0);
  const baselineEvent = useRef<MatchEvent | null>(null);
  const lastEventRef = useRef<MatchEvent | null>(lastEvent);
  lastEventRef.current = lastEvent;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    if (timer.current) clearTimeout(timer.current);
    setAlert(null);
  };

  // A new LOOK-UP fires the interrupt (respecting the frequency cap + de-dupe).
  useEffect(() => {
    if (!lookup) return;
    const id = lookupId(lookup);
    if (alertRef.current?.id === id) return;
    if (Date.now() - lastShownAt.current < FREQ_CAP_MS) return; // anti-spam
    lastShownAt.current = Date.now();
    baselineEvent.current = lastEventRef.current; // resolve only against a NEWER event
    setAlert({ id, lookup, phase: 'incoming' });
    vibrate([0, 60, 40, 120]);
    playSwing(lookup.side, 0.2);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(dismiss, INCOMING_MS);
  }, [lookup]);

  // The real event lands → resolve "you didn't miss it".
  useEffect(() => {
    const a = alertRef.current;
    if (!a || a.phase !== 'incoming' || !lastEvent) return;
    if (lastEvent === baselineEvent.current) return;
    if (!resolves(a.lookup, lastEvent)) return;
    setAlert({ ...a, phase: 'resolved', event: lastEvent });
    vibrate([0, 30, 20, 30, 20, 90]);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(dismiss, RESOLVED_MS);
  }, [lastEvent]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!alert) return null;
  const player = playerFor(alert.lookup);

  return (
    <div
      onClick={dismiss}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center px-8 backdrop-blur-sm animate-[fadein_.2s_ease-out]"
    >
      <div className={`absolute inset-0 bg-gradient-to-b ${sideColor(alert.lookup.side)} bg-neutral-950/80`} />
      <div className="relative flex flex-col items-center gap-3">
        {alert.phase === 'incoming' ? (
          <>
            <div className="text-amber-400 text-lg font-semibold tracking-[.3em] animate-pulse">⚡ LOOK UP</div>
            <div className="text-5xl font-black leading-tight">{player}</div>
            <div className="text-neutral-300 text-xl">{incomingLine(alert.lookup.kind)}</div>
            <div className="text-neutral-500 text-sm mt-2">don&apos;t miss it</div>
          </>
        ) : (
          <>
            <div className="text-6xl font-black text-white">{resolvedHead(alert.event!.kind)}</div>
            <div className="text-3xl font-bold">{player}</div>
            <div className="text-emerald-400 text-lg mt-1">You didn&apos;t miss it.</div>
          </>
        )}
      </div>
    </div>
  );
}
