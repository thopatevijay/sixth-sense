# TxLINE API — Developer Feedback

Honest notes from building SIXTH SENSE against TxLINE (TxODDS) during the hackathon — what worked
well, and the friction points, in the spirit of making the API easier for the next builder.

## What we loved

- **Solana-native auth is genuinely novel.** `guest/start` → on-chain `subscribe` → `activate` makes
  "sign up through Solana" intrinsic rather than bolted-on. The free World Cup tier (0 TxL, pay only
  gas) made a hackathon build actually viable.
- **The real-time feed is rich.** `possessionType` (safe/attack/danger/high-danger), the
  `possibleEvent` imminent flags, per-player `PlayerStats`, and dense in-play events (shots, corners,
  cards, substitutions, VAR) gave us far more to work with than a plain scores feed. Our entire
  product is built on signals most sports APIs don't expose.
- **SSE with a stable event envelope** was easy to consume and to tee to a replay file — which became
  both our dev fixture and our demo asset.

## Friction & gotchas (where we lost time)

1. **Liveness truth is `Clock.Running`, not `GameState`.** The `fixtures/snapshot` `GameState` field
   stayed `scheduled`/`1` even for a match that was clearly live and streaming. We only found the
   real signal (`Clock.Running: true` in the scores snapshot) by trial and error. **A documented
   "is this fixture live right now?" field would save everyone hours.**

2. **Devnet does not stream live in-play data.** On the free devnet tier, a 30+ minute wait on a live
   match produced only SSE heartbeats — the scores snapshot stayed empty/`scheduled`. Real in-play
   deltas only arrive on the **mainnet real-time tier (SL 12)**. This devnet-vs-mainnet *streaming*
   difference (separate from the 60s delay) wasn't obvious up front and shaped our whole architecture.

3. **`possibleEvent.Goal` semantics need a line in the docs.** Measured across a full match, it's an
   imminent-**chance/threat** flag (~1 in 4 goals tightly preceded by one; most flags are chances that
   don't score), *not* a goal predictor. That's a great signal — but only once you know what it means.
   One sentence in the docs would prevent misuse (and, frankly, prevent people building tipster apps).

4. **Coverage varies per fixture — with no way to know in advance.** One knockout fixture we tried
   returned only heartbeats and a *frozen* clock (no possession / no possible-event stream), while
   another match on the same tier streamed everything richly. A per-fixture **coverage/depth
   indicator** would let apps degrade gracefully instead of showing a dead screen.

5. **Event shape has sharp edges.** The event kind is the **top-level `Action`** (not `Data.Action`),
   `possible` carries its flags under `Data:{Goal,Corner,Penalty}`, and a **`goal` frame repeats** per
   goal (amendments/VAR) — so consumers must dedup by score increment or they over-count. A published
   JSON schema / changelog for the SSE event union would remove a lot of guesswork.

6. **Onboarding details.** The `startEpochDay` fixtures query, the `GameState` enum values, and the
   exact `subscribe` account order + discriminator were reverse-engineered from the IDL rather than
   documented end-to-end. A single "hello, live match in 15 minutes" quickstart would be gold.

## Open questions we'd still love answered

- Does the API token survive a JWT refresh (30-day expiry), or must we re-`activate`?
- Are there rate limits on streams / snapshots we should design around?
- Which markets (`SuperOddsType` / `MarketParameters`) are guaranteed for *all* 104 WC matches?

## Net

TxLINE exposes signals no other sports API does, and the Solana-native auth is a real differentiator.
The friction is almost entirely **documentation & discoverability**, not capability — a live-fixture
indicator, a coverage flag, an event-union schema, and one clarifying sentence on `possibleEvent` would
take the developer experience from "reverse-engineered in a hackathon" to "shipped in an afternoon."
