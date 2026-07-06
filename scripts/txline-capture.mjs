#!/usr/bin/env node
// TxLINE live capture + possibleEvent lead-time analyzer.
// Reads creds from .txline-session.json. Streams a fixture's scores SSE, records every
// event with a local receive timestamp to replay-<fixtureId>.jsonl, and after the capture
// window prints: event-type counts, every possibleEvent occurrence, and the measured lead
// time between a possibleEvent flag and the matching real event in the stream.
//
//   node scripts/txline-capture.mjs <fixtureId> [durationSeconds=120]
//   START_AT=2026-07-06T18:55:00Z node scripts/txline-capture.mjs 18198205 9000   # wait for kickoff
//
// Env:
//   START_AT   — optional ISO time; wait until then before connecting (schedule for kickoff)
//   NO_RECONNECT — set to disable auto-reconnect on stream drop
//
// NOTE on lead time: the devnet free tier is 60s-delayed, but the delay is a CONSTANT
// offset — the relative gap between a possibleEvent flag and the subsequent real event
// is preserved. So lead time measured here is the true lead time.

import fs from 'node:fs';

const fid = process.argv[2];
const durationMs = (Number(process.argv[3]) || 120) * 1000;
if (!fid) { console.error('usage: txline-capture.mjs <fixtureId> [seconds]'); process.exit(1); }

const s = JSON.parse(fs.readFileSync('.txline-session.json', 'utf8'));
const baseHeaders = { Authorization: `Bearer ${s.jwt}`, 'X-Api-Token': s.apiToken, Accept: 'text/event-stream' };
const url = `${s.base}/api/scores/stream?fixtureId=${fid}`;
const reconnect = !process.env.NO_RECONNECT;

const events = [];                 // { t, obj }  t = local receive ms
const out = fs.createWriteStream(`replay-${fid}.jsonl`, { flags: 'a' });
const log = (...a) => console.log(new Date().toISOString(), ...a);

// deep scan for any key matching /possible.*event/i and return the truthy sub-flags
function findPossible(obj, path = '') {
  const hits = [];
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (/possible.*event/i.test(k) && v && typeof v === 'object') {
        const trueFlags = Object.entries(v).filter(([, val]) => val === true).map(([kk]) => kk);
        if (trueFlags.length) hits.push({ key: `${path}${k}`, flags: trueFlags });
      }
      if (v && typeof v === 'object') hits.push(...findPossible(v, `${path}${k}.`));
    }
  }
  return hits;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitForStart() {
  if (!process.env.START_AT) return;
  const startMs = Date.parse(process.env.START_AT);
  if (Number.isNaN(startMs)) throw new Error(`bad START_AT: ${process.env.START_AT}`);
  const delay = startMs - Date.now();
  if (delay > 0) {
    log(`⏳ waiting until ${process.env.START_AT} (${(delay / 60000).toFixed(1)} min) before connecting…`);
    // sleep in <=15-min chunks so the process shows liveness in logs
    let remaining = delay;
    while (remaining > 0) { const chunk = Math.min(remaining, 15 * 60 * 1000); await sleep(chunk); remaining -= chunk; if (remaining > 0) log(`   …still waiting, ${(remaining / 60000).toFixed(0)} min left`); }
  }
}

async function captureOnce(deadlineMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(0, deadlineMs - Date.now()));
  try {
    const res = await fetch(url, { headers: baseHeaders, signal: ac.signal });
    if (!res.ok) throw new Error(`stream ${res.status}: ${(await res.text()).slice(0, 200)}`);
    log(`📡 connected to fixture ${fid} stream`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) { log('stream ended (server closed)'); break; }
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const evt = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = evt.split('\n').find(l => l.startsWith('data:'))?.slice(5).trim();
        if (!data) continue;
        out.write(data + '\n');
        const t = Date.now();
        let obj; try { obj = JSON.parse(data); } catch { continue; }
        events.push({ t, obj });
        const poss = findPossible(obj);
        const act = obj?.Data?.Action || obj?.Action;
        const pt = obj?.PossessionType;
        if (poss.length) log(`🔮 POSSIBLE ${JSON.stringify(poss)}  clk=${obj?.Clock?.Seconds ?? '?'} pt=${pt ?? '-'}`);
        else if (act && act !== 'action_amend') log(`▶ ${act}  clk=${obj?.Clock?.Seconds ?? '?'} pt=${pt ?? '-'}`);
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  await waitForStart();
  const deadlineMs = Date.now() + durationMs;
  log(`▶ capturing fixture ${fid} until ${new Date(deadlineMs).toISOString()} (${(durationMs / 60000).toFixed(0)} min)`);
  while (Date.now() < deadlineMs) {
    try { await captureOnce(deadlineMs); }
    catch (e) { if (e.name === 'AbortError') break; log('⚠️ stream error:', e.message); }
    if (Date.now() < deadlineMs && reconnect) { log('↻ reconnecting in 3s…'); await sleep(3000); }
    else break;
  }
  analyze();
}

function analyze() {
  console.log(`\n===== ANALYSIS (${events.length} events) =====`);
  if (!events.length) { console.log('no data events captured (match not live / all heartbeats).'); return; }
  const actionCounts = {};
  for (const { obj } of events) {
    const a = obj?.Data?.Action || obj?.Action || (Object.keys(obj).length === 1 && obj.Ts ? 'heartbeat' : 'amend');
    actionCounts[a] = (actionCounts[a] || 0) + 1;
  }
  console.log('action counts:', actionCounts);

  const possibles = events.flatMap(({ t, obj }) => findPossible(obj).map(p => ({ t, ...p, clk: obj?.Clock?.Seconds })));
  console.log(`\npossibleEvent flags fired: ${possibles.length}`);
  for (const p of possibles) console.log('  🔮', new Date(p.t).toISOString(), p.key, p.flags, 'clk', p.clk);

  const realActions = events.filter(({ obj }) => /goal|penalty|card|corner|var/i.test(obj?.Data?.Action || obj?.Action || ''));
  console.log(`\nreal scoring/discipline events: ${realActions.length}`);
  for (const p of possibles) {
    const match = realActions.find(({ t, obj }) => t > p.t && new RegExp(p.flags.join('|'), 'i').test(obj?.Data?.Action || obj?.Action || ''));
    if (match) console.log(`  ⏱ lead time for ${p.flags}: ${((match.t - p.t) / 1000).toFixed(1)}s`);
  }
  console.log('\nsaved →', `replay-${fid}.jsonl`);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
