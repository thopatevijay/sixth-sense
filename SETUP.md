# Setup

How to configure and run SIXTH SENSE. Secrets live in `.env` / `.txline-session.json` (both gitignored).

## 0. Prerequisites

- Node 20+
- A Solana keypair (devnet for dev; a small-funded mainnet keypair for the real-time feed)

## 1. Install

```bash
npm install            # root: TxLINE auth/capture scripts
cd relay && npm install # relay service
```

## 2. Configure env

```bash
cp .env.example .env    # fill in as you provision services (step 4)
```

## 3. TxLINE session

```bash
# devnet (60s-delayed, free — good for dev)
TX_NET=devnet TX_KEYPAIR_PATH=~/.config/solana/id.json npm run auth
# mainnet (real-time SL 12 — for the live demo; needs ~0.02 SOL on the keypair)
TX_NET=mainnet TX_KEYPAIR_PATH=~/mainnet.json npm run auth
```

Writes `.txline-session.json`. Verify: `npm run probe:snapshot` (expects HTTP 200, a fixtures list).

## 4. Services (provision as needed)

| Service | Env | Where |
|---|---|---|
| Privy (login + invisible wallet) | `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `NEXT_PUBLIC_PRIVY_APP_ID` | privy.io |
| Helius (RPC + DAS) | `HELIUS_API_KEY`, `HELIUS_RPC_URL` | helius.dev |
| Postgres | `DATABASE_URL` | Supabase / Neon |
| Relay host | — | Railway / Fly / Render (see `relay/Dockerfile`) |
| Vercel | — | app deploy |

## 5. Run the relay

```bash
cd relay
npm run dev                       # MOCK on :8787 — no services needed
RELAY_DEFAULT_MODE=replay npm start
npm run verify                    # headless checks
```

Open `http://localhost:8787/` for the test page. See `relay/README.md` for modes + endpoints.

## 6. Capture a live match (builds the demo replay)

```bash
node scripts/txline-capture.mjs <fixtureId> 9000
# or schedule for kickoff:
START_AT=2026-07-19T18:55:00Z node scripts/txline-capture.mjs <fixtureId> 9000
```

Produces `replay-<fixtureId>.jsonl` — feed it to the relay in `replay` mode.
