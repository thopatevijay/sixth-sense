# Setup

How to run SIXTH SENSE locally and deploy it. Live demo: **https://sixth-sense-wc.vercel.app**

Secrets live in `app/.env.local` / `.txline-session.json` / keypairs — all gitignored, never commit.

## Repo layout

```
scripts/   TxLINE auth + capture + probe (root package.json)
relay/     standalone Node SSE relay — LIVE / REPLAY / MOCK, one output contract
app/       Next.js PWA — reads app/.env.local ; API routes /api/mint, /api/leaderboard
app/db/schema.sql          leaderboard schema + seed
app/scripts/create-tree.mjs  one-time Bubblegum tree creator (devnet)
```

## Prerequisites

- Node 20+
- A Solana keypair (devnet is fine for everything; the on-chain program/cNFT live on devnet).
  For the *real-time* TxLINE feed you also need a small-funded **mainnet** keypair (~0.02 SOL).
- Docker (for local Postgres) — optional; the leaderboard degrades to a seed board without it.

## Fastest path — see it running in 2 terminals (no external services)

```bash
# Terminal A — relay in MOCK (synthesizes a full hero-arc match)
cd relay && npm install && npm run dev            # http://localhost:8787

# Terminal B — app
cd app && npm install && npm run dev              # http://localhost:3000
```

With no `NEXT_PUBLIC_PRIVY_APP_ID` set, the app uses a **local dev-bypass** for sign-in, so you can
click through the whole loop immediately. Add Privy (below) for real Google/email login + a wallet.

## Configure the app (`app/.env.local`)

```bash
cd app && cp ../.env.example .env.local
```

| Var | For | Where |
|---|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` + `PRIVY_APP_ID` + `PRIVY_APP_SECRET` | login + invisible wallet | privy.io (add your domains to allowed origins) |
| `HELIUS_API_KEY` + `HELIUS_RPC_URL` | Solana RPC + DAS (use the **devnet** URL) | helius.dev |
| `DATABASE_URL` | leaderboard | local docker / Railway (below) |
| `FEE_PAYER_KEYPAIR` | gasless mint payer | a keypair **path** (local) or **inline JSON array** (Vercel) |
| `BUBBLEGUM_TREE_ADDRESS` | cNFT tree | from `create-tree.mjs` (below) |
| `NEXT_PUBLIC_RELAY_URL` + `NEXT_PUBLIC_RELAY_MODE` | which relay + mode (`mock`/`replay`/`live`) | your relay URL |

## TxLINE session (for LIVE mode / capturing)

```bash
npm install                                                  # root deps
TX_NET=mainnet TX_KEYPAIR_PATH=~/mainnet.json npm run auth    # real-time SL 12 (needs mainnet SOL)
#   or devnet for the data shape only (devnet does NOT stream live in-play data):
TX_NET=devnet  TX_KEYPAIR_PATH=~/.config/solana/id.json npm run auth
npm run probe:snapshot                                       # verify (expects HTTP 200)
```

Writes `.txline-session.json`. The relay reads it in LIVE mode (`TX_SESSION_PATH` to override the path).

## Local Postgres (leaderboard)

```bash
docker run -d --name sixthsense-pg -e POSTGRES_USER=sixth -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=sixthsense -p 5432:5432 postgres:16
psql "postgresql://sixth:secret@localhost:5432/sixthsense" -f app/db/schema.sql
# then in app/.env.local:
# DATABASE_URL=postgresql://sixth:secret@localhost:5432/sixthsense
```

Without `DATABASE_URL` the leaderboard serves a seed board (honest "demo standings" label).

## cNFT mint (one-time tree, devnet)

```bash
cd app
node scripts/create-tree.mjs        # uses HELIUS_RPC_URL + FEE_PAYER_KEYPAIR from .env.local
# → prints BUBBLEGUM_TREE_ADDRESS=...  ; paste it into app/.env.local
```

`/api/mint` then mints a gasless Bubblegum cNFT to the user's wallet and returns an assetId that
Helius DAS confirms. Without the tree/fee-payer, the Moment still renders + shares (no chain claim).

## Capture a live match (build a REPLAY asset)

```bash
node scripts/txline-capture.mjs <fixtureId> 9000
START_AT=2026-07-19T18:55:00Z node scripts/txline-capture.mjs <fixtureId> 9000   # wait for kickoff
```
Produces `replay-<fixtureId>.jsonl`. Point the relay at it: `REPLAY_PATH=replay-<id>.jsonl RELAY_DEFAULT_MODE=replay npm start`.

## Deploy (Vercel + Railway)

**Relay + Postgres → Railway:**
```bash
railway init --name sixth-sense
railway add -d postgres
railway add --service relay --variables "RELAY_DEFAULT_MODE=replay" \
  --variables "REPLAY_PATH=fixtures/demo-arg-egy.jsonl" --variables "REPLAY_LOOP=1" \
  --variables "REPLAY_SPEED=3" --variables "CORS_ORIGIN=*"
railway up relay --path-as-root --detach     # IMPORTANT: --path-as-root so it builds relay/Dockerfile
railway domain                               # public relay URL
psql "$RAILWAY_DB_PUBLIC_URL" -f app/db/schema.sql
```

**App → Vercel** (run from `app/`):
```bash
cd app && vercel link --yes --project sixth-sense
# set production env (FEE_PAYER_KEYPAIR as INLINE JSON, DATABASE_URL = Railway public URL,
# NEXT_PUBLIC_RELAY_URL = Railway relay URL, plus Privy/Helius/tree):
#   vercel env add <NAME> production
vercel deploy --prod --yes
```

Then: **disable Vercel Deployment Protection** (Project → Settings → Deployment Protection) so it's
public, and **add the deployed domain to Privy allowed origins** or login fails.
