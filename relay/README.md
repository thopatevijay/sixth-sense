# SIXTH SENSE — Relay

The data spine. One relay abstraction, **three interchangeable modes**, **one output contract**.
Everything downstream (SURGE, LOOK-UP, Moment) consumes only the normalized union — the browser is
**mode-agnostic** and can't tell live from replay from mock.

```
TxLINE SSE ─┐
replay.jsonl ├─▶  Normalizer ──▶  union events  ──SSE──▶  browser
synth (mock)─┘   (surge/lookup/event/heartbeat)
```

## Modes

| Mode | Source | Needs | Use |
|---|---|---|---|
| `live` | TxLINE odds+scores SSE | `.txline-session.json` (mainnet real-time / devnet 60s) | Real matches; captures to `replay-<fixtureId>.jsonl` |
| `replay` | a captured `.jsonl` | the file | Deterministic demo / dev with no live match |
| `mock` | synthesized hero-arc | nothing | Build & demo the full loop offline |

## Run

```bash
npm install
npm run dev          # tsx watch, default MOCK on :8787
# or
PORT=8787 RELAY_DEFAULT_MODE=replay npm start
npm run verify       # headless Gate-1 checks (mock + replay determinism)
npm run typecheck
```

Open `http://localhost:8787/` for the mode-agnostic test page.

## Endpoints

- `GET /stream?fixtureId=<n>&mode=live|replay|mock` — SSE of union events (`mode` optional, defaults to `RELAY_DEFAULT_MODE`).
- `GET /health` — `{ ok, defaultMode, streams:[{key,clients}] }`.
- `GET /` — browser test page.

## Output contract (`src/types.ts`)

```ts
{ type:'surge',  fixtureId, p1Pct, p2Pct, possession, possessionType, clock }
{ type:'lookup', fixtureId, kind, side, playerId?, playerName?, source, clock }
{ type:'event',  fixtureId, kind, side, playerId?, playerName?, score?, clock }
{ type:'heartbeat', ts }
```

## Env

| Var | Default | Notes |
|---|---|---|
| `PORT` | `8787` | |
| `RELAY_DEFAULT_MODE` | `mock` | deployed link should use `replay` (FR-D1) |
| `CORS_ORIGIN` | `*` | set to the app origin in prod |
| `TX_SESSION_PATH` | `.txline-session.json` | LIVE creds (or `TX_BASE`/`TX_JWT`/`TX_API_TOKEN`) |
| `MOCK_DURATION_MS` | `90000` | MOCK match length |
| `REPLAY_SPEED` / `REPLAY_MAX_GAP_MS` | `1` / `4000` | REPLAY pacing |
| `NO_CAPTURE` | — | set to disable LIVE capture tee |

## Status

- **All three modes verified.** `npm run verify` (mock + replay determinism + multi-source rules) and
  `npx tsx verify-real.ts` (real capture) pass; deployed on Railway serving REPLAY in production.
- **Normalizer handles the real TxLINE feed** — top-level `Action`, `possible` flags from
  `Data:{Goal,Corner,Penalty}`, possession danger from the action name, goal dedup by score. Proven
  against `fixtures/demo-arg-egy.jsonl` (Argentina 3–2 Egypt): 495 surge · 62 lookup · 4 goals.
- **Multi-source LOOK-UP** fires from `possible` + sustained danger + sharp `Pct` swing (frequency-capped).
- **REPLAY_LOOP=1** loops the arc so a deployed demo link never dead-ends.
