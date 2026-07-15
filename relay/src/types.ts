// The relay's browser-facing output contract (PRP §8.1).
//
// LIVE, REPLAY and MOCK all emit exactly this union — the browser is mode-agnostic
// and can never tell which source produced a tick (FR-R2, FR-R3).

export type Mode = 'live' | 'replay' | 'mock';

/** Which participant a signal favours. 1 = home/Participant1, 2 = away/Participant2. */
export type Side = 1 | 2 | null;

/** How dangerous the current possession is. Drives SURGE micro-motion. */
export type PossessionType = 'Safe' | 'Attack' | 'Danger' | 'HighDanger' | null;

/** Directional momentum from de-margined consensus odds + live possession. Feeds SURGE. */
export interface SurgeTick {
  type: 'surge';
  fixtureId: number;
  /** Fair win-probability for Participant1, 0..1 (3dp). */
  p1Pct: number;
  /** Fair win-probability for Participant2, 0..1 (3dp). */
  p2Pct: number;
  possession: Side;
  possessionType: PossessionType;
  /** Match clock in seconds. */
  clock: number;
}

/** Which upstream signal produced a LOOK-UP (for confidence + the demo frequency slide). */
export type LookUpSource = 'possible' | 'shot' | 'danger' | 'swing';

/** App-as-oracle alert: something high-leverage is imminent. The hero. Feeds LOOK-UP. */
export interface LookUp {
  type: 'lookup';
  fixtureId: number;
  kind: 'goal' | 'penalty' | 'card' | 'var';
  side: Side;
  playerId?: number;
  playerName?: string;
  source: LookUpSource;
  clock: number;
}

/** A real thing that happened on the pitch. Used to resolve a LOOK-UP ("you didn't miss it"). */
export interface MatchEvent {
  type: 'event';
  fixtureId: number;
  kind: 'goal' | 'card' | 'corner' | 'sub' | 'var';
  side: Side;
  playerId?: number;
  playerName?: string;
  /** Current score, e.g. { p1: 1, p2: 0 }. */
  score?: { p1: number; p2: number };
  clock: number;
}

/** Keepalive. Ignored by the UI; keeps the SSE connection warm. */
export interface Heartbeat {
  type: 'heartbeat';
  ts: number;
}

export type UnionEvent = SurgeTick | LookUp | MatchEvent | Heartbeat;

/** A source pushes normalized union events into this sink. */
export type Sink = (ev: UnionEvent) => void;

/** One interchangeable data source (LIVE / REPLAY / MOCK). */
export interface Source {
  readonly mode: Mode;
  readonly fixtureId: number;
  /** Begin producing events into `sink`. Resolves when the source is exhausted. */
  run(sink: Sink): Promise<void>;
  /** Stop early and release upstream resources. */
  stop(): void;
}
