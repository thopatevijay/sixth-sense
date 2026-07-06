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

- **Engineering (Gate 1 plumbing): green** — 3 modes behind one contract, REPLAY deterministic,
  fan-out shares one upstream across clients, verified by `npm run verify` + live SSE curl test.
- **LIVE wiring:** compiles and mirrors the proven `scripts/txline-capture.mjs` SSE logic; gets its
  first real exercise at Phase 0 (mainnet token) / the FR-L6 live capture.
- **Open data gate (FR-L6):** whether `possibleEvent` fires with usable lead time is proven only by a
  live in-play capture. The normalizer + capture pipeline are ready to measure it.
