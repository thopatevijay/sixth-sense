// Raw TxLINE scores/odds events -> the internal union (FR-R2).
//
// The relay subscribes to BOTH the scores stream (possession, events, possibleEvent)
// and the odds stream (Pct fair probabilities). A Normalizer holds the small amount of
// per-fixture state needed to emit *complete* surge ticks (odds arrive on one stream,
// possession on the other), and turns discrete signals into `lookup` / `event` ticks.
//
// Confirmed-live shapes (doc 03, Brazil v Norway 2026-07-06): PossessionType (e.g.
// "DangerPossession"), Clock{Running,Seconds}, Data.Action, PlayerStats, Score.
// The odds `Pct` mapping and `possibleEvent` sub-flag layout are documented-but-not-yet
// -fired assumptions — isolated here so they finalize in one place when the FR-L6
// live capture lands. MOCK mode exercises the full union at full fidelity meanwhile.

import type {
  LookUp,
  MatchEvent,
  PossessionType,
  Side,
  SurgeTick,
  UnionEvent,
} from './types.js';

type Json = Record<string, unknown>;

const KNOWN_POSSESSION = ['Safe', 'Attack', 'Danger', 'HighDanger'] as const;

/** "DangerPossession" | "Danger" | 3 -> 'Danger'. Tolerant of suffixes and casing. */
export function parsePossessionType(v: unknown): PossessionType {
  if (typeof v === 'string') {
    for (const t of KNOWN_POSSESSION) if (v.toLowerCase().includes(t.toLowerCase())) return t;
  }
  return null;
}

/** "Participant1" | 1 | "1" -> 1 ; away -> 2 ; anything else -> null. */
export function parseSide(v: unknown): Side {
  if (v === 1 || v === '1' || (typeof v === 'string' && /1|home|participant1/i.test(v))) return 1;
  if (v === 2 || v === '2' || (typeof v === 'string' && /2|away|participant2/i.test(v))) return 2;
  return null;
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

/**
 * Deep-scan for possibleEvent flag groups. Handles both plausible layouts:
 *   flat:        { SoccerPossiblePartiEvent: { Goal: true, Penalty: true } }
 *   per-team:    { SoccerPossiblePartiEvent: { Participant1: { Goal: true } } }
 * Returns one hit per (event group, side), with `side` derived from a participant key.
 */
function findPossibleFlags(obj: unknown): Array<{ side: Side; flags: string[] }> {
  const hits: Array<{ side: Side; flags: string[] }> = [];
  const walk = (o: unknown): void => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (/possible.*event/i.test(k) && v && typeof v === 'object') {
        const flat = Object.entries(v as Json).filter(([, val]) => val === true).map(([kk]) => kk);
        if (flat.length) hits.push({ side: parseSide(k) ?? sideFromFlags(flat), flags: flat });
        for (const [sub, subVal] of Object.entries(v as Json)) {
          if (subVal && typeof subVal === 'object') {
            const nested = Object.entries(subVal as Json).filter(([, val]) => val === true).map(([kk]) => kk);
            if (nested.length) hits.push({ side: parseSide(sub), flags: nested });
          }
        }
      } else if (v && typeof v === 'object') {
        walk(v);
      }
    }
  };
  walk(obj);
  return hits;
}

/** Some feeds encode the participant inside the flag name (e.g. "Goal_Participant2"). */
function sideFromFlags(flags: string[]): Side {
  for (const f of flags) {
    const s = parseSide(f);
    if (s) return s;
  }
  return null;
}

/** Map a possibleEvent flag name to a LOOK-UP kind. Corner -> null (not a hero kind). */
function flagToKind(flag: string): MatchEvent['kind'] | 'penalty' | null {
  const f = flag.toLowerCase();
  if (f.includes('goal')) return 'goal';
  if (f.includes('penalty')) return 'penalty';
  if (f.includes('red') || f.includes('yellow') || f.includes('card')) return 'card';
  if (f.includes('var')) return 'var';
  return null; // corner and unknowns don't drive the hero alert
}

/** Map a scores Data.Action to a MatchEvent kind. */
function actionToKind(action: string): MatchEvent['kind'] | null {
  const a = action.toLowerCase();
  if (a.includes('goal')) return 'goal';
  if (a.includes('card')) return 'card';
  if (a.includes('corner')) return 'corner';
  if (a.includes('sub')) return 'sub';
  if (a.includes('var')) return 'var';
  return null;
}

function readScore(obj: Json): { p1: number; p2: number } | undefined {
  const s = obj.Score as Json | undefined;
  if (!s) return undefined;
  const p1 = num((s.Participant1 as Json)?.Goals ?? (s as Json).Participant1);
  const p2 = num((s.Participant2 as Json)?.Goals ?? (s as Json).Participant2);
  if (p1 === undefined || p2 === undefined) return undefined;
  return { p1, p2 };
}

export class Normalizer {
  private p1Pct = 0.5;
  private p2Pct = 0.5;
  private possession: Side = null;
  private possessionType: PossessionType = null;
  private clock = 0;

  // Rules-engine state (FR-L1 secondary/tertiary sources + frequency cap).
  private dangerStreak = 0;
  private dangerSide: Side = null;
  private lastSwingShare = 0.5;
  private lastLookupClock = -1e9;
  private static readonly LOOKUP_GAP_SECONDS = 25; // anti-spam between engine lookups

  constructor(readonly fixtureId: number) {}

  /** True when a raw object is just a keepalive (`{Ts: ...}` or empty of match keys). */
  private isHeartbeat(obj: Json): boolean {
    const keys = Object.keys(obj);
    return keys.length === 0 || (keys.length === 1 && 'Ts' in obj);
  }

  /** Ingest one raw scores-stream object. Returns 0+ union events. */
  ingestScores(raw: unknown): UnionEvent[] {
    if (!raw || typeof raw !== 'object') return [];
    const obj = raw as Json;
    if (this.isHeartbeat(obj)) return [{ type: 'heartbeat', ts: num(obj.Ts) ?? Date.now() }];

    const out: UnionEvent[] = [];
    const clk = num((obj.Clock as Json)?.Seconds);
    if (clk !== undefined) this.clock = clk;

    let stateChanged = false;
    if ('PossessionType' in obj) {
      this.possessionType = parsePossessionType(obj.PossessionType);
      stateChanged = true;
    }
    if ('Possession' in obj) {
      this.possession = parseSide(obj.Possession);
      stateChanged = true;
    }

    // possibleEvent imminent flags -> LOOK-UP (primary source).
    for (const hit of findPossibleFlags(obj)) {
      for (const flag of hit.flags) {
        const kind = flagToKind(flag);
        if (!kind || kind === 'corner') continue;
        out.push({
          type: 'lookup',
          fixtureId: this.fixtureId,
          kind: kind as 'goal' | 'penalty' | 'card' | 'var',
          side: hit.side,
          source: 'possible',
          clock: this.clock,
        });
        this.lastLookupClock = this.clock; // primary fires; secondary/tertiary respect the gap
      }
    }

    // Secondary source: sustained Danger/HighDanger on one side → "something building".
    if (this.possessionType === 'Danger' || this.possessionType === 'HighDanger') {
      if (this.dangerSide === this.possession) this.dangerStreak += 1;
      else {
        this.dangerStreak = 1;
        this.dangerSide = this.possession;
      }
      if (this.dangerStreak >= 2) {
        const lk = this.engineLookup('danger', this.possession, 'goal');
        if (lk) {
          out.push(lk);
          this.dangerStreak = 0;
        }
      }
    } else {
      this.dangerStreak = 0;
      this.dangerSide = null;
    }

    // Data.Action -> a real MatchEvent.
    const data = obj.Data as Json | undefined;
    const action = typeof data?.Action === 'string' ? data.Action : undefined;
    if (action) {
      const kind = actionToKind(action);
      if (kind) {
        out.push({
          type: 'event',
          fixtureId: this.fixtureId,
          kind,
          side: parseSide(data?.Participant ?? obj.Participant),
          playerId: num(data?.PlayerId ?? data?.PlayerInId),
          score: readScore(obj),
          clock: this.clock,
        });
      }
    }

    // A possession/danger change refreshes the surge feel even without new odds.
    if (stateChanged) out.push(this.surge());
    return out;
  }

  /** Ingest one raw odds-stream object; update fair probabilities and emit a surge tick. */
  ingestOdds(raw: unknown): UnionEvent[] {
    if (!raw || typeof raw !== 'object') return [];
    const obj = raw as Json;
    if (this.isHeartbeat(obj)) return [{ type: 'heartbeat', ts: num(obj.Ts) ?? Date.now() }];

    const pcts = extractWinPcts(obj);
    if (!pcts) return [];
    this.p1Pct = pcts.p1;
    this.p2Pct = pcts.p2;

    const out: UnionEvent[] = [];
    // Tertiary source: a sharp swing in the market's belief → it senses danger.
    const share = this.p1Pct / (this.p1Pct + this.p2Pct || 1);
    if (Math.abs(share - this.lastSwingShare) >= 0.06) {
      const lk = this.engineLookup('swing', share > this.lastSwingShare ? 1 : 2, 'goal');
      if (lk) out.push(lk);
    }
    this.lastSwingShare = share;

    out.push(this.surge());
    return out;
  }

  /** Emit an engine (secondary/tertiary) lookup, honoring the frequency cap. */
  private engineLookup(source: 'danger' | 'swing', side: Side, kind: 'goal'): LookUp | null {
    if (this.clock - this.lastLookupClock < Normalizer.LOOKUP_GAP_SECONDS) return null;
    this.lastLookupClock = this.clock;
    return { type: 'lookup', fixtureId: this.fixtureId, kind, side, source, clock: this.clock };
  }

  /** Feed pre-computed values (MOCK / tests) and get a surge tick. */
  setSurge(p1Pct: number, p2Pct: number, possession: Side, possessionType: PossessionType, clock: number): SurgeTick {
    this.p1Pct = p1Pct;
    this.p2Pct = p2Pct;
    this.possession = possession;
    this.possessionType = possessionType;
    this.clock = clock;
    return this.surge();
  }

  private surge(): SurgeTick {
    return {
      type: 'surge',
      fixtureId: this.fixtureId,
      p1Pct: round3(this.p1Pct),
      p2Pct: round3(this.p2Pct),
      possession: this.possession,
      possessionType: this.possessionType,
      clock: this.clock,
    };
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Pull Participant1/Participant2 fair win-probabilities out of an odds payload.
 * Looks for a match-winner (1X2 / moneyline) market and its per-outcome `Pct`.
 * Defensive against the not-yet-confirmed exact shape; finalized at FR-L6 capture.
 */
export function extractWinPcts(obj: Json): { p1: number; p2: number } | null {
  const rows = Array.isArray(obj) ? obj : Array.isArray(obj.Odds) ? (obj.Odds as unknown[]) : [obj];
  let p1: number | undefined;
  let p2: number | undefined;

  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Json;
    const pct = num(row.Pct);
    if (pct === undefined) continue;
    const label = `${row.SuperOddsType ?? ''} ${row.MarketParameters ?? ''} ${row.Outcome ?? ''} ${row.Selection ?? ''}`.toLowerCase();
    // Match-winner outcomes: home (1) / away (2). Draw is ignored for the two-sided bar.
    if (/(^|\b)(1|home|participant1)(\b|$)/.test(label) && !/draw/.test(label)) p1 ??= pct;
    else if (/(^|\b)(2|away|participant2)(\b|$)/.test(label)) p2 ??= pct;
  }

  if (p1 === undefined && p2 === undefined) return null;
  // If only one side is known, treat the remainder (minus a nominal draw share) as the other.
  if (p1 === undefined) p1 = Math.max(0, 1 - (p2 ?? 0) - 0.25);
  if (p2 === undefined) p2 = Math.max(0, 1 - p1 - 0.25);
  return { p1, p2 };
}
