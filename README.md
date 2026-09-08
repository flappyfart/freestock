# freestock

Private product beta for a savings pool where time-weighted entries compete for stock-token prizes funded from realized net yield. The interface follows the requested Nexaris direction: white and cobalt surfaces, dimensional stock artwork, large rounded cards, and accessible motion. No real deposits, wallet signatures, lending, trades, or Chainlink messages occur in this build.

## Use the product

Sign in, add simulated USDG, and advance the clock. Seven simulated days freeze an entry snapshot and reserve a prize from available simulated net yield. Reveal the result, settle the example prize, and claim if your entry wins. Withdrawals reserve funds first and return them to the practice wallet when completed. Activity and allocations persist per signed-in user.

The scenario starts each user with 10,000 practice USDG and four fixed example savers totaling 32,500. The 4% annual gross-yield assumption, 10% yield-cost assumption, $10 prize and weekly cadence are provisional scenario inputs, not promised returns, proposed fees, live balances or final product policy. A simulated stock allocation is a dollar credit, not a share or token quantity.

## Local development

Node 22.13+ and npm are required.

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Sites supplies local sign-in at `/signin-with-chatgpt`. Production authentication is supplied by the Sites dispatcher; the Worker must only be reachable through its trusted dispatcher. No app-owned passwords or session tokens are stored. Never expose a raw public Worker origin that lets callers forge the dispatch identity headers.

D1 schema is managed by `db/schema.ts` and the committed Drizzle migrations. Sites applies these migrations on deployment. For isolated local testing, apply the migration with Wrangler to the same `--persist-to` directory used by the local Worker. The HTTP test runner deliberately refuses non-local origins:

```sh
TEST_ORIGIN=http://localhost:3011 npm run test:api
```

The generated `dist/server/wrangler.json` can run an isolated test Worker. Keep test persistence separate from `.wrangler/state` used by the visible development preview.

## Architecture

- `lib/engine.ts`: immutable pure state transitions, six-decimal integer USDG, exact asset-second entry weights, unbiased rejection sampling for simulated randomness, prize reservations and conservation invariants.
- `lib/store.ts`: D1 account aggregate with optimistic concurrency and permanent idempotency receipts. The account CAS and receipt insert share one atomic D1 batch. A duplicate key cannot commit a second mutation. Replays return the original receipt and current state.
- `app/api`: authenticated, per-user requests; same-origin mutations; strict command validation; 4 KB streaming body limit; uncached responses; real actions absent.
- `app/freestock.tsx`: responsive product surface, accessible Base UI primitives, immutable draw record inspection, local JSON export, and optional WebMCP tools.
- `scripts/verify-integrations.mjs`: allowlisted read-only RPC probe. Defaults to recorded blocks; `--latest` refreshes observations. No signing or transaction methods are allowed.

Each private preview is an independent scenario. Accounts do not share a real pool. All financial decisions are made server-side. Browser state is a rendering cache, not authoritative accounting.

## Design

The active theme is `app/nexaris.css`, followed by `app/motion.css`. It adapts the Nexaris reference with white surfaces, cobalt sections, rounded controls, and self-hosted Plus Jakarta Sans headings with Inter body text. The original stock artwork was generated for freestock. The earlier Auros and forest themes remain archived but are not imported. Uiverse attribution and font licenses are retained in `THIRD_PARTY_NOTICES.md` and `public/fonts/`.

`app/landing-intro.tsx` presents the user-supplied reaching-hands clip with its central cross removed and an NVIDIA card rendered over it. The edited clip is silent, 3 seconds, and ends before the original flashing sequence. The intro dismisses within 3.5 seconds, supports Skip/Escape/Tab, skips repeat visits in the same tab session, and is hidden for reduced motion. Playback failure and deep links skip it. The real account loads independently beneath the intro.

`app/motion-effects.tsx` draws a decorative blue dot field, bounded to about 6,000 dots and 24 frames per second; it pauses in hidden tabs and has a visible pause control. `app/scroll-motion.tsx` progressively reveals below-fold sections once, including newly mounted tabs, while keeping focused/deep-linked content immediately visible. Server-rendered content remains visible without the enhancement. Reduced-motion preferences disable all entrance/hover movement. Hero bobbing and supported CSS scroll parallax share the pause control.

The homepage introduces the savings-to-prizes model with `app/homepage-intro.tsx`: the earnings tradeoff, a $100 deposit through 700 entries, and both winning and nonwinning outcomes. After a user's first draw, an account summary appears above that fixed example. Waiting prizes have direct claim buttons; claimed stocks are listed separately from deposited savings. Account state refreshes on Home navigation and when the tab regains focus. `lib/prizes.ts` derives user-only totals, excluding awards to other savers; regression tests cover pending claims, repeated claims, reload serialization, and separate savings accounting.

The homepage's separate pool-size illustration defaults to $1M, with $100K and $10M options. It models a constant pool earning 4% annually, deducts 10% of earnings as costs, and awards the weekly net budget to one winner: approximately $69 / $690 / $6,904. A fixed $100 held for the full week has odds of 1 in 1,000 / 10,000 / 100,000 respectively, assuming every participant holds for the full week. `lib/prize-projection.ts` contains this illustration; it does not alter the account engine's $10 practice prize. The headline, controls, odds, and disclaimer distinguish potential future scale from available practice awards.

## Production activation remains blocked

This is a tested application foundation, not an audited or funded protocol. The implementation does not include live custody contracts, a VRF consumer, a CCIP sender/receiver, a stock execution adapter, or an indexer. There is deliberately no environment switch that enables real deposits.

1. Approve the product rules, supported jurisdictions, eligibility, custody/asset model, fee policy and draw cadence.
2. Build contracts from the reviewed invariants. Identify and reproduce the deployed vault source, then pass a fresh unprivileged contract deposit/share/redemption round trip on a pinned mainnet fork.
3. Add vault-share NAV, loss/high-water accounting, partial liquidity, queued withdrawals, pause behavior and rounding tests. The paper model conserves nominal capital and assumes withdrawal liquidity; it cannot model a live guarantee.
4. Implement storage-only VRF fulfillment; separately retry CCIP and stock execution. Bind immutable snapshots, request IDs, chain selectors, authenticated senders and duplicate-message protection. No rerolls on failures.
5. Obtain and test an executable stock-token route, bounded allowance/spend, minimum received, deadline, price freshness and multiplier handling. Preserve actual token and USDG balance deltas. Awards are stock tokens, not underlying share ownership.
6. Independent security audit, legal approval, production monitoring, incident recovery, indexing/reorg handling, admin access control, RPC failover, load tests, wallet onboarding and transaction UX.
7. Complete browser interaction, mobile and assistive-technology QA before a public release. Automated code/API checks do not substitute for this.

See `docs/INTEGRATION-READINESS.md` for September 8, 2026 live read evidence and sources, and `docs/PROTOCOL-DESIGN.md` for the contract acceptance criteria. Read-only network support does not prove a transaction succeeds.
