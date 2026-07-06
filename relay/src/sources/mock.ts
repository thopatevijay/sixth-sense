// MOCK source — synthesizes a full, deterministic hero-arc match (FR-R3).
//
// This is what the app is built and demoed against while the live-capture gate (FR-L6)
// is open. It exercises the entire union: continuous SURGE micro-motion, LOOK-UP alerts
// that fire *before* a real event and then resolve, escalating drama, a final equalizer.
// Deterministic (seeded PRNG) so the arc replays identically for the demo and for tests.

import type { PossessionType, Side, Sink, Source, UnionEvent } from '../types.js';
import { Normalizer } from '../normalize.js';

const MATCH_SECONDS = 5400; // 90' of match clock, compressed into real wall-clock below.
const SURGE_INTERVAL_MS = 700;
const POSSESSION_TYPES: PossessionType[] = ['Safe', 'Attack', 'Danger', 'HighDanger'];

interface Player {
  id: number;
  name: string;
}
interface Moment {
  at: number; // fraction of match [0,1] when the LOOK-UP fires
  leadMs: number; // how long before the real event lands
  kind: 'goal' | 'penalty' | 'card' | 'var';
  eventKind: 'goal' | 'card' | 'corner' | 'sub' | 'var';
  side: Side;
  source: 'possible' | 'danger' | 'swing';
  scoreDelta?: Side; // which side's goal count increments when the event lands
  player: Player;
}

const P1 = { id: 100, name: 'Mbappé' };
const P1B = { id: 101, name: 'Griezmann' };
const P2 = { id: 200, name: 'Vinícius Jr' };
const P2B = { id: 201, name: 'Rodrygo' };

// Escalating drama: fall behind, equalize, a card, a penalty go-ahead, a late equalizer.
const SCENARIO: Moment[] = [
  { at: 0.15, leadMs: 2600, kind: 'goal', eventKind: 'goal', side: 2, source: 'danger', scoreDelta: 2, player: P2 },
  { at: 0.35, leadMs: 2400, kind: 'goal', eventKind: 'goal', side: 1, source: 'possible', scoreDelta: 1, player: P1 },
  { at: 0.55, leadMs: 1800, kind: 'card', eventKind: 'card', side: 2, source: 'swing', player: P2B },
  { at: 0.70, leadMs: 3000, kind: 'penalty', eventKind: 'goal', side: 1, source: 'possible', scoreDelta: 1, player: P1B },
  { at: 0.88, leadMs: 2500, kind: 'goal', eventKind: 'goal', side: 2, source: 'danger', scoreDelta: 2, player: P2B },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MockSource implements Source {
  readonly mode = 'mock' as const;
  private readonly norm: Normalizer;
  private readonly durationMs: number;
  private readonly rand: () => number;
  private timers = new Set<NodeJS.Timeout>();
  private stopped = false;
  private p1 = 0.42; // start slight underdog to make the equalizers land
  private p2 = 0.33;
  private score = { p1: 0, p2: 0 };

  constructor(
    readonly fixtureId: number,
    opts: { durationMs?: number; seed?: number } = {},
  ) {
    this.norm = new Normalizer(fixtureId);
    this.durationMs = opts.durationMs ?? (Number(process.env.MOCK_DURATION_MS) || 90_000);
    this.rand = mulberry32(opts.seed ?? 0x51_7e);
  }

  run(sink: Sink): Promise<void> {
    return new Promise((resolve) => {
      const started = Date.now();
      const scheduled = new Set<Moment>();

      // Schedule the scripted LOOK-UP / event pairs.
      for (const m of SCENARIO) {
        const lookupAt = m.at * this.durationMs;
        this.after(lookupAt, () => {
          if (scheduled.has(m)) return;
          scheduled.add(m);
          const clock = Math.round(m.at * MATCH_SECONDS);
          // Nudge momentum toward the acting side so SURGE leans into the moment.
          if (m.side === 1) this.p1 = Math.min(0.8, this.p1 + 0.06);
          else if (m.side === 2) this.p2 = Math.min(0.8, this.p2 + 0.06);
          sink({
            type: 'lookup',
            fixtureId: this.fixtureId,
            kind: m.kind,
            side: m.side,
            playerId: m.player.id,
            playerName: m.player.name,
            source: m.source,
            clock,
          });
          // The real event lands after the lead time.
          this.after(lookupAt + m.leadMs, () => {
            if (m.scoreDelta === 1) this.score.p1 += 1;
            else if (m.scoreDelta === 2) this.score.p2 += 1;
            sink({
              type: 'event',
              fixtureId: this.fixtureId,
              kind: m.eventKind,
              side: m.side,
              playerId: m.player.id,
              playerName: m.player.name,
              score: { ...this.score },
              clock: clock + Math.round(m.leadMs / 1000),
            });
          });
        });
      }

      // Continuous SURGE ticker: random-walk the probabilities + cycle possession.
      const tick = () => {
        if (this.stopped) return;
        const elapsed = Date.now() - started;
        if (elapsed >= this.durationMs) {
          sink({ type: 'heartbeat', ts: Date.now() });
          resolve();
          return;
        }
        this.step(elapsed / this.durationMs);
        const clock = Math.round((elapsed / this.durationMs) * MATCH_SECONDS);
        sink(this.norm.setSurge(this.p1, this.p2, this.possession(), this.possessionType(), clock));
        this.timers.add(setTimeout(tick, SURGE_INTERVAL_MS));
      };
      this.timers.add(setTimeout(tick, 0));
    });
  }

  private step(_progress: number): void {
    // Small mean-reverting random walk so the bar always breathes but stays plausible.
    const jitter = (this.rand() - 0.5) * 0.03;
    this.p1 = clamp(this.p1 + jitter, 0.2, 0.8);
    this.p2 = clamp(this.p2 - jitter * 0.8, 0.15, 0.8);
  }

  private possession(): Side {
    return this.rand() > 0.5 ? 1 : 2;
  }

  private possessionType(): PossessionType {
    // Weight toward Safe/Attack; occasional Danger spikes give SURGE its pulse.
    const r = this.rand();
    const idx = r > 0.9 ? 3 : r > 0.75 ? 2 : r > 0.4 ? 1 : 0;
    return POSSESSION_TYPES[idx] ?? 'Safe';
  }

  private after(ms: number, fn: () => void): void {
    this.timers.add(setTimeout(() => !this.stopped && fn(), ms));
  }

  stop(): void {
    this.stopped = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export const _internal = { SCENARIO } as { SCENARIO: Moment[] };
export type { UnionEvent };
