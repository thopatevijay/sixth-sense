'use client';

// Client-side mirror of the relay's union contract (relay/src/types.ts) + the hook that
// consumes it over SSE. The client is MODE-AGNOSTIC — it never knows or cares whether the
// relay is in live, replay, or mock (FR-R3). EventSource auto-reconnects (FR-R6 / NFR-2).

import { useEffect, useRef, useState } from 'react';

export type Side = 1 | 2 | null;
export type PossessionType = 'Safe' | 'Attack' | 'Danger' | 'HighDanger' | null;
export type RelayMode = 'live' | 'replay' | 'mock';

export interface SurgeTick {
  type: 'surge';
  fixtureId: number;
  p1Pct: number;
  p2Pct: number;
  possession: Side;
  possessionType: PossessionType;
  clock: number;
}
export interface LookUp {
  type: 'lookup';
  fixtureId: number;
  kind: 'goal' | 'penalty' | 'card' | 'var';
  side: Side;
  playerId?: number;
  playerName?: string;
  source: 'possible' | 'danger' | 'swing';
  clock: number;
}
export interface MatchEvent {
  type: 'event';
  fixtureId: number;
  kind: 'goal' | 'card' | 'corner' | 'sub' | 'var';
  side: Side;
  playerId?: number;
  playerName?: string;
  score?: { p1: number; p2: number };
  clock: number;
}
export interface Heartbeat {
  type: 'heartbeat';
  ts: number;
}
export type UnionEvent = SurgeTick | LookUp | MatchEvent | Heartbeat;

export type ConnStatus = 'connecting' | 'live' | 'reconnecting';

export interface RelayState {
  status: ConnStatus;
  surge: SurgeTick | null;
  lookup: LookUp | null;
  lastEvent: MatchEvent | null;
  score: { p1: number; p2: number };
  tickCount: number;
}

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL || 'http://localhost:8787';

export function relayStreamUrl(fixtureId: number, mode: RelayMode): string {
  return `${RELAY_URL}/stream?fixtureId=${fixtureId}&mode=${mode}`;
}

/** Subscribe to the relay for one fixture. Returns the latest reactive state. */
export function useRelay(fixtureId: number, mode: RelayMode): RelayState {
  const [state, setState] = useState<RelayState>({
    status: 'connecting',
    surge: null,
    lookup: null,
    lastEvent: null,
    score: { p1: 0, p2: 0 },
    tickCount: 0,
  });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(relayStreamUrl(fixtureId, mode));
    esRef.current = es;

    es.onopen = () => setState((s) => ({ ...s, status: 'live' }));
    es.onerror = () => setState((s) => ({ ...s, status: 'reconnecting' }));

    es.onmessage = (e) => {
      let ev: UnionEvent;
      try {
        ev = JSON.parse(e.data) as UnionEvent;
      } catch {
        return;
      }
      setState((s) => {
        const next: RelayState = { ...s, status: 'live', tickCount: s.tickCount + 1 };
        if (ev.type === 'surge') next.surge = ev;
        else if (ev.type === 'lookup') next.lookup = ev;
        else if (ev.type === 'event') {
          next.lastEvent = ev;
          if (ev.score) next.score = ev.score;
        }
        return next;
      });
    };

    return () => es.close();
  }, [fixtureId, mode]);

  return state;
}
