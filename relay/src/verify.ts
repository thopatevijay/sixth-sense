// Headless Gate-1 verification (no external services): drives the MOCK and REPLAY
// sources directly and asserts the union contract + determinism. Run: `npm run verify`.

import { MockSource } from './sources/mock.js';
import { ReplaySource } from './sources/replay.js';
import { Normalizer } from './normalize.js';
import type { UnionEvent } from './types.js';

function collect(source: { run(sink: (e: UnionEvent) => void): Promise<void> }): Promise<UnionEvent[]> {
  const out: UnionEvent[] = [];
  return source.run((e) => out.push(e)).then(() => out);
}

const fail = (msg: string): never => {
  console.error('❌', msg);
  process.exit(1);
};

async function verifyMock(): Promise<void> {
  const events = await collect(new MockSource(18198205, { durationMs: 4000 }));
  const kinds = new Set(events.map((e) => e.type));
  for (const need of ['surge', 'lookup', 'event'] as const) {
    if (!kinds.has(need)) fail(`MOCK produced no '${need}' events`);
  }
  // Every LOOK-UP must be followed by a resolving event (the "you didn't miss it" contract).
  const lookups = events.filter((e) => e.type === 'lookup');
  const eventsAfter = events.filter((e) => e.type === 'event');
  if (eventsAfter.length < lookups.length) fail('MOCK: some LOOK-UPs never resolved to an event');
  // Named players present (self-contained hero arc).
  if (!lookups.some((l) => l.type === 'lookup' && l.playerName)) fail('MOCK: LOOK-UP missing playerName');
  console.log(`✅ MOCK: ${events.length} events — surge/lookup/event all present, ${lookups.length} lookups resolved, named players ✓`);
}

async function verifyReplayDeterminism(): Promise<void> {
  const path = 'fixtures/demo-scores.jsonl';
  const a = await collect(new ReplaySource(18187298, { path, speed: 1000, maxGapMs: 5 }));
  const b = await collect(new ReplaySource(18187298, { path, speed: 1000, maxGapMs: 5 }));
  const norm = (evs: UnionEvent[]) => JSON.stringify(evs.filter((e) => e.type !== 'heartbeat'));
  if (norm(a) !== norm(b)) fail('REPLAY is non-deterministic across runs');

  const types = a.map((e) => e.type);
  if (!types.includes('surge')) fail('REPLAY: no surge from possession changes');
  if (!a.some((e) => e.type === 'lookup')) fail('REPLAY: possibleEvent did not produce a lookup');
  if (!a.some((e) => e.type === 'event' && e.kind === 'goal')) fail('REPLAY: goal action did not normalize to an event');
  const goal = a.find((e) => e.type === 'event' && e.kind === 'goal');
  if (goal && goal.type === 'event' && (goal.score?.p1 !== 1 || goal.side !== 1)) fail('REPLAY: goal side/score misnormalized');
  const lookup = a.find((e) => e.type === 'lookup');
  if (lookup && lookup.type === 'lookup' && lookup.side !== 1) fail('REPLAY: possibleEvent side not derived from participant key');
  console.log(`✅ REPLAY: deterministic across 2 runs — ${a.length} events, possession→surge, possibleEvent→lookup(side ${lookup && lookup.type === 'lookup' ? lookup.side : '?'}), goal→event ✓`);
}

function verifyRulesEngine(): void {
  const n = new Normalizer(1);
  const lookups: UnionEvent[] = [];
  const collect = (evs: UnionEvent[]) => lookups.push(...evs.filter((e) => e.type === 'lookup'));

  // Secondary: two sustained HighDanger/Danger ticks on side 2 → a 'danger' lookup.
  collect(n.ingestScores({ Clock: { Seconds: 100 }, Possession: 'Participant2', PossessionType: 'HighDangerPossession' }));
  collect(n.ingestScores({ Clock: { Seconds: 105 }, Possession: 'Participant2', PossessionType: 'DangerPossession' }));
  // Advance clock past the frequency cap, then a sharp odds swing → a 'swing' lookup.
  collect(n.ingestScores({ Clock: { Seconds: 140 }, Possession: 'Participant1', PossessionType: 'SafePossession' }));
  collect(n.ingestOdds([{ SuperOddsType: '1X2', Outcome: '1', Pct: 0.7 }, { SuperOddsType: '1X2', Outcome: '2', Pct: 0.2 }]));

  const sources = new Set(lookups.map((l) => (l.type === 'lookup' ? l.source : '')));
  if (!sources.has('danger')) fail('rules engine: sustained danger did not emit a danger lookup');
  if (!sources.has('swing')) fail('rules engine: sharp odds swing did not emit a swing lookup');
  const danger = lookups.find((l) => l.type === 'lookup' && l.source === 'danger');
  if (danger && danger.type === 'lookup' && danger.side !== 2) fail('rules engine: danger lookup wrong side');
  console.log(`✅ RULES: multi-source — sources fired: ${[...sources].join(', ')} (FR-L1 secondary+tertiary)`);
}

async function main(): Promise<void> {
  console.log('— Gate 1 + Gate 4 headless verification —');
  await verifyMock();
  await verifyReplayDeterminism();
  verifyRulesEngine();
  console.log('✅ ALL PASS');
}

main().catch((e) => fail((e as Error).message));
