// One-off: feed the REAL captured replay through the normalizer and report what it emits.
// Run: npx tsx verify-real.ts [replay-file]
import fs from 'node:fs';
import readline from 'node:readline';
import { Normalizer } from './src/normalize.js';
import type { UnionEvent } from './src/types.js';

const path = process.argv[2] ?? 'replay-18202701.jsonl';
const norm = new Normalizer(18202701);
const counts: Record<string, number> = { surge: 0, lookup: 0, event: 0, heartbeat: 0 };
const bySource: Record<string, number> = {};
const goals: Array<{ clock: number; score?: { p1: number; p2: number } }> = [];
const possibleGoalLookups: number[] = [];

const rl = readline.createInterface({ input: fs.createReadStream(path), crlfDelay: Infinity });
for await (const line of rl) {
  const s = line.trim();
  if (!s) continue;
  let raw: unknown;
  try { raw = JSON.parse(s); } catch { continue; }
  for (const ev of norm.ingestScores(raw) as UnionEvent[]) {
    counts[ev.type] = (counts[ev.type] ?? 0) + 1;
    if (ev.type === 'lookup') {
      bySource[ev.source] = (bySource[ev.source] ?? 0) + 1;
      if (ev.source === 'possible' && ev.kind === 'goal') possibleGoalLookups.push(ev.clock);
    }
    if (ev.type === 'event' && ev.kind === 'goal') goals.push({ clock: ev.clock, score: ev.score });
  }
}

console.log('union event counts:', counts);
console.log('lookups by source:', bySource);
console.log('GOALS emitted (deduped):', goals.length,
  goals.map((g) => `${(g.clock / 60).toFixed(1)}' ${g.score?.p1}-${g.score?.p2}`).join('  |  '));
console.log('\nprecognition check (possible-goal flag before each goal, by match clock):');
for (const g of goals) {
  const before = possibleGoalLookups.filter((c) => c <= g.clock).sort((a, b) => b - a)[0];
  console.log(`  goal @${(g.clock / 60).toFixed(1)}'  <-  ` +
    (before !== undefined ? `possible-goal @${(before / 60).toFixed(1)}' (Δ${g.clock - before}s)` : 'no preceding flag'));
}
