#!/usr/bin/env node
// TxLINE de-risk probe. Node 18+ (built-in fetch). No framework.
// Usage:
//   node scripts/txline-probe.mjs                 # guest JWT + on-chain subscribe + activate
//   node scripts/txline-probe.mjs --snapshot      # pull fixtures + odds/scores snapshot (needs token)
//   node scripts/txline-probe.mjs --stream        # tail the SSE stream (needs token + FIXTURE_ID)
//
// Env: TX_BASE, TXODDS_PROGRAM_ID, TX_KEYPAIR_PATH, TX_JWT, TX_API_TOKEN, FIXTURE_ID
//
// NOTE: the subscribe tx needs @coral-xyz/anchor + the devnet IDL (see /documentation/programs/devnet).
// Steps that need on-chain signing are marked TODO — wire them once the IDL is downloaded. The
// snapshot/stream probes work as soon as you have a token, and validate the data shape (Risk 3).

import fs from 'node:fs';

const BASE = process.env.TX_BASE || 'http://txline-dev.txodds.com';
const mode = process.argv.includes('--snapshot') ? 'snapshot'
  : process.argv.includes('--stream') ? 'stream'
  : 'auth';

async function guestStart() {
  const r = await fetch(`${BASE}/auth/guest/start`, { method: 'POST' });
  if (!r.ok) throw new Error(`guest/start ${r.status}`);
  const { token } = await r.json();
  console.log('✅ guest JWT:', token.slice(0, 24) + '…  (expires ~30d)');
  return token;
}

// TODO(Risk 2): implement subscribe + activate once the devnet IDL is in place.
//   1. Load keypair from TX_KEYPAIR_PATH.
//   2. Build `subscribe` ix (duration = multiple of 4 weeks, free tier -> 0 TxL), send, confirm -> txSig.
//   3. Sign message binding txSig + leagues + jwt with tweetnacl (detached, base64).
//   4. POST /api/token/activate { txSig, walletSignature, leagues:[<WC league id>] } with Bearer jwt.
//   5. Print X-Api-Token.
async function subscribeAndActivate(jwt) {
  console.log('\n⏭  subscribe+activate: fill in with the devnet IDL — see DERISK.md Risk 2.');
  console.log('   jwt ready; program:', process.env.TXODDS_PROGRAM_ID);
}

function authedHeaders() {
  const jwt = process.env.TX_JWT, token = process.env.TX_API_TOKEN;
  if (!jwt || !token) throw new Error('Set TX_JWT and TX_API_TOKEN (run auth mode first).');
  return { Authorization: `Bearer ${jwt}`, 'X-Api-Token': token };
}

async function snapshot() {
  const h = authedHeaders();
  const today = Math.floor(Date.now() / 86400000); // epoch day
  const fx = await (await fetch(`${BASE}/api/fixtures/snapshot?startEpochDay=${today}`, { headers: h })).json();
  console.log(`\n📅 fixtures today: ${Array.isArray(fx) ? fx.length : 'n/a'}`);
  console.log(JSON.stringify(Array.isArray(fx) ? fx.slice(0, 3) : fx, null, 2));

  const fid = process.env.FIXTURE_ID;
  if (!fid) return console.log('\nSet FIXTURE_ID to inspect a match’s markets (Risk 3).');
  const odds = await (await fetch(`${BASE}/api/odds/snapshot/${fid}`, { headers: h })).json();
  const scores = await (await fetch(`${BASE}/api/scores/snapshot/${fid}`, { headers: h })).json();
  const markets = [...new Set((odds || []).map(o => `${o.SuperOddsType}|${o.MarketParameters}`))];
  console.log('\n🎯 distinct markets seen:', markets);
  console.log('   sample Pct (fair prob):', (odds || [])[0]?.Pct);
  console.log('   scores keys:', Object.keys((scores || [])[0] || {}));
}

async function stream() {
  const h = { ...authedHeaders(), Accept: 'text/event-stream' };
  const fid = process.env.FIXTURE_ID;
  const url = `${BASE}/api/scores/stream${fid ? `?fixtureId=${fid}` : ''}`;
  console.log(`\n📡 opening SSE ${url} (Ctrl-C to stop)…`);
  const res = await fetch(url, { headers: h });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const out = fs.createWriteStream(`replay-${fid || 'all'}.jsonl`, { flags: 'a' });
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const evt = buf.slice(0, i); buf = buf.slice(i + 2);
      const data = evt.split('\n').find(l => l.startsWith('data:'))?.slice(5).trim();
      if (data) { out.write(data + '\n'); console.log('•', data.slice(0, 160)); }
    }
  }
}

(async () => {
  try {
    if (mode === 'auth') { const jwt = await guestStart(); await subscribeAndActivate(jwt); }
    else if (mode === 'snapshot') await snapshot();
    else await stream();
  } catch (e) { console.error('❌', e.message); process.exit(1); }
})();
