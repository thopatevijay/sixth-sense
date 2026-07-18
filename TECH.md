# SIXTH SENSE — Technical Overview

Core idea, architecture, the exact TxLINE integration, and a real-match signal analysis.
Companion to the [README](./README.md). Live demo: **https://sixth-sense-wc.vercel.app**

---

## 1. Core idea

Turn the richest real-time signal in sports — the live betting market's *belief*, plus TxODDS's
in-play event feed — into something a **non-betting, mainstream fan** can feel:

1. **SURGE** — a number-free directional momentum bar (consensus `Pct` + possession danger).
2. **LOOK-UP** — an app-as-oracle alert that fires *seconds before* a goal/card, **names the player**,
   then resolves *"you didn't miss it."* It predicts **events**, never **outcomes** → not a tipster.
3. **Verified Moment** — the match's defining swing as an evolving Solana cNFT, **Merkle-verifiable**
   against TxODDS's on-chain consensus (a screenshot can't do that).

## 2. Architecture

```
TxLINE odds+scores SSE ─▶ RELAY (Node, holds token) ─▶ union events ──SSE──▶ Next.js PWA (Vercel)
                          normalize · rules engine · capture                  │   ├ /api/mint  → Bubblegum cNFT (devnet) → Helius DAS
                          3 modes: LIVE / REPLAY / MOCK                        │   └ /api/leaderboard → Postgres
```

- **The relay is mandatory & standalone.** Browser `EventSource` cannot set TxLINE's `X-Api-Token`
  header, and Vercel serverless can't hold an SSE stream open. So a Node relay holds the creds,
  normalizes the feed, runs the rules engine, and fans out to browsers — keeping secrets server-side.
- **One relay, three modes, one output contract** (`surge` / `lookup` / `event` / `heartbeat`). The
  browser is mode-agnostic → dev never needs a live match and the deployed demo always works. LIVE
  mode tees every raw event to `replay-*.jsonl` (the demo asset *is* a real capture).
- **Deploy:** app → **Vercel**, relay + Postgres → **Railway**. Real-time TxLINE tier is mainnet;
  our cNFT/wallet layer is devnet (free), decoupled.

### The event union (browser-facing contract)
```ts
{ type:'surge',  fixtureId, p1Pct, p2Pct, possession, possessionType, clock }
{ type:'lookup', fixtureId, kind, side, playerId?, playerName?, source:'possible'|'shot'|'danger'|'swing', clock }
{ type:'event',  fixtureId, kind:'goal'|'card'|'corner'|'sub'|'var', side, playerName?, score?, clock }
{ type:'heartbeat', ts }
```

### Multi-source LOOK-UP rules engine (why it's not one lucky flag)
Fuses three independent signals, frequency-capped so it reads as signal not spam:
1. **Primary** — `possibleEvent` imminent flags (`Data:{Goal,Corner,Penalty}` on an `Action:"possible"` frame).
2. **Secondary** — sustained `danger` / `high_danger` possession on one side.
3. **Tertiary** — a sharp swing in consensus `Pct`.
The player name comes from joining the acting side with live `PlayerStats` / lineup.

## 3. TxLINE integration (exact)

**Solana-native auth:** `POST /auth/guest/start` → guest JWT → **on-chain `subscribe(service_level_id, weeks)`**
(TxODDS program, Token-2022, free WC tier = 0 TxL) → `POST /api/token/activate {txSig, walletSignature, leagues[]}`
→ long-lived API token. All data calls send `Authorization: Bearer <jwt>` **and** `X-Api-Token: <token>`.

| Endpoint | Used for |
|---|---|
| `GET /api/fixtures/snapshot?startEpochDay=<n>` | match list — **liveness = `Clock.Running`, NOT `GameState`** |
| `GET /api/odds/stream?fixtureId=` | consensus `Pct` (de-margined fair win-prob) → **SURGE** |
| `GET /api/scores/stream?fixtureId=` | `Action` events (`possible`/`goal`/`shot`/`possession`/`card`/`corner`/`var`/`substitution`), `possessionType`, `PlayerStats` → **LOOK-UP** |
| `GET /api/odds/snapshot/{fixtureId}` · `GET /api/scores/snapshot/{fixtureId}` | enumerate markets / current state |
| `GET /api/scores/stat-validation` | provable-fairness stamp for the Moment |

**Real feed shape gotcha:** the SSE event kind is the **top-level `Action`** (not `Data.Action`);
`possible` carries `Data:{Goal,Corner,Penalty}` booleans; and a `goal` frame **repeats** per goal, so
scores must be deduped by score increment (we dedup in the normalizer).

## 4. Signal analysis — does it actually work?

Measured on a **real mainnet capture** of the 2nd half of **Argentina 3–2 Egypt** (1002 raw events),
normalized by the exact relay code the app runs:

| Metric | Value |
|---|---|
| SURGE ticks | **495** |
| LOOK-UP signals | **62** (sources: sustained-danger **33** · possible-flag **26** · shot **3**) |
| Goals (deduped) | **4** — 57.9′, 78.7′, 83.0′, 91.9′ (Argentina comeback 0–2 → **3–2**) |
| Precognition | the **57.9′ goal was flagged by a `possibleEvent.Goal` ~3.1s early** |

**Honest finding:** `possibleEvent.Goal` is an **imminent-chance/threat** flag — roughly **1 in 4 goals**
is tightly flagged, and most flags are dangerous chances that *don't* score. That's *why* we (a) frame
LOOK-UP as an **imminent-drama detector, never a goal/outcome predictor** (which also keeps it firmly
non-betting), and (b) **fuse three sources** so the hero stays meaningful even when the flag is quiet.

## 5. On-chain (real, verified)

- **Bubblegum cNFT** minted **gaslessly** (fee-payer pays ~5,000 lamports; the fan owns it, signs nothing).
- Devnet Merkle tree `J2v5D8fat2HZqBtefbu2qFd1ZzceW1nfqW6tgPwFJezn`.
- Verified via **Helius DAS `getAsset`** → `compressed: true`, correct tree + owner. Example asset minted
  live from the deployed app: `zqNGbbUV…JmAzak`.
- The "Verified on Solana ✓" badge only appears on a confirmed mint — the share-card image itself is
  rendered fully client-side and **always works**, decoupled from chain state.

## 6. Business model

See [README → Monetization](./README.md#monetization). In one line: license the SURGE + LOOK-UP
"switch to this match now" signal layer to broadcasters/streamers (TxODDS's own customers) as a
white-label tune-in driver.
