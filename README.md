# freestock

Private USDG lending and Stock Token wallet pilot with a simulation modal for exploring DeFi scenarios. The modal uses a separate demo account to create lending scenarios, model leveraged LP exposure, choose single Stock Tokens or custom baskets, auto-convert simulated earnings, compound them into DeFi, or split between both. The requested white/cobalt design, transparent floating stock artwork, dither background and NVIDIA arrival intro remain in place.

**The live flow is Home → Connect Wallet → Dashboard.** `/dashboard` is the place to create and manage a live position in the private, participant-restricted pilot for USDG lending and purchases of NVIDIA, Apple, Tesla, Alphabet and SPY tokens from available gains. “Try it yourself” opens an accessible simulation modal containing setup, saved results and activity. The demo uses no real funds. There is no separate Wallet page. Each deployment, approval, deposit, compound, purchase and withdrawal requires an explicit wallet transaction. No agent has submitted public transactions or moved real funds. Background automation, staking and leveraged LP execution are not enabled.

## Working routes

- `/`: Home, with Connect Wallet leading to Dashboard and “Try it yourself” opening the simulation modal.
- `/dashboard`: a sidebar workspace for Overview, Your position, Market explorer and Advanced tools. Actual chain balances, participant status, recovery and wallet transaction reviews stay together. Read-only market and quote checks request no signatures; transactions open the wallet only after explicit review.
- `/learn`: plain-English concepts, earnings sources, compounding, timing, leverage and stock-token exposure.
- `/docs`: current capability matrix, exact model mechanics, sources, saved records and execution boundaries.
- `/live`: compatibility redirect to `/dashboard`; not a separate Wallet page.
- `/demo`: compatibility entry into the simulation modal’s results view, not a standalone results page.
- `/transparency`: compatibility entry into the modal’s activity view, including the detailed saved ledger and JSON export.
- `/fairness`: legacy entry through Demo activity. The draw/prize concept has been retired.

`app/demo/demo-link.tsx` exports `DemoLink` for opening the global simulation modal from any page. Its optional `view` selects `setup`, `results` or `activity`. Setup switches to results only after the scenario is confirmed saved. Simulated positions, balances and holdings stay in the results view; the detailed ledger stays in activity. All three views use no real funds.

## Accounting and automation

A new demo account starts with 10,000 simulated USDG. Open “Try it yourself” to set up a scenario, manage saved results or inspect activity inside the same modal. Money uses integer micro-USDG; basket weighting uses BigInt intermediates. `lib/earn-engine.ts` applies pure state transitions. Losing scenarios consume pending earnings then principal; later gains first recover lost principal. A selected percentage of remaining surplus compounds into the position, and the remainder waits for manual or threshold-based stock conversion. Closing returns capital; earnings below the 1 USDG conversion minimum also return to the wallet. Other pending earnings remain convertible after closure.

Lending converts the observed seven-day vault APY to an effective daily rate, then accrues linearly within each simulation step. Fractions below one micro-USDG carry into the next step. Compounding happens at step boundaries. The observed rate is fixed for that position, not treated as a forecast or live accrual.

The LP model uses leverage, fee APR, borrowing APR, annual costs on exposure and an optional LP value shock. Leverage resets to the selected multiple each step without rebalancing costs. Liquidation thresholds, real collateral mechanics and withdrawal queues are not simulated. Stocks are purchased at disclosed fixed illustrative prices, assuming 1 USDG = $1 and zero gas/spread/trading fees. These are approximate simulated token quantities, not real holdings or current valuations.

## Data

`lib/markets.ts` reads current balances and seven-day rates for one tracked Steakhouse USDG vault and five previously verified listed Morpho USDG markets on Robinhood Chain 4663. Directory membership was checked September 8, 2026. This is an explicit subset; it does not claim all-chain pool coverage. Vault and market assets overlap and are never added together. Refresh failure returns the dated snapshot with a prominent status. Read-only observations do not establish an executable route. See the in-app Docs for direct source links.

`/api/stock-lending/markets` reads five separately verified AAPL, GOOGL, NVDA, SPY and TSLA loan-asset markets with USDG collateral. Home provides USDG/Stock lending tabs; Dashboard also shows the stock market feed. Stock lending is data-only: no stock approval, supply or withdrawal route is enabled. Amounts retain 18-decimal precision, missing responses never become zero, and historical rates are independent of balance availability. See [stock-lending verification](docs/STOCK-LENDING.md) and `/docs#stock-lending`.

## Persistence and requests

`lib/earn-store.ts` saves independent per-owner state in `earn_accounts` and permanent request receipts in `earn_commands`. A compare-and-swap update and receipt insertion share an atomic D1 batch. Duplicate retries return the original receipt and current state. Server routes obtain account identity from trusted Sites dispatch headers, validate same-origin requests, bound streamed bodies to 4 KB and return uncached private responses.

The original `accounts`/`commands` tables and old engine tests are retained for historical data compatibility. New accounts never borrow funds from retired prize accounts. `/api/commands` returns 410 and no longer changes old prize state. Never expose an untrusted raw Worker origin that accepts forged dispatcher identity headers.

## Local development and validation

Node 22.13+ and npm are required. Run `npm ci`, `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. Sites supplies local sign-in. D1 schema comes from `db/schema.ts` and append-only Drizzle migrations in `drizzle/`; Sites applies them on deploy.

`TEST_ORIGIN=http://localhost:3011 npm run test:api` only accepts local origins, refuses redirects, and creates isolated test identities. Use the same local D1 persistence directory for migrations and the test Worker. Tests cover account isolation, request validation, duplicate/concurrent actions, compounding, baskets, loss recovery, closure and retired routes. No hosted accounts are mutated by these checks.

Historical documents are labeled as superseded. `/learn` and `/docs` describe the active product. The simulated engine never handles real funds. The wallet pilot verifies the exact deployment, owner, dependencies and receipts. A specific signed-in participant is enabled through runtime configuration; country declarations are not identity verification or public launch approval.

## First live integration

See `docs/LIVE-PILOT.md` for verified dependencies, account semantics, fork evidence and exact activation boundaries. `contracts/src/FreestockYieldAccount.sol` is compiled reproducibly in `contracts/artifacts`. No shared mainnet account has been deployed by the builder. Each participant creates their own account directly from an EOA wallet. Private product access does not verify issuer eligibility; stock provider restrictions still apply. No API key is required for the direct AMM route. Set `ROBINHOOD_RPC_URL` to an HTTPS production RPC for dedicated capacity; otherwise reads use the official public RPC and fail closed on provider errors. Runtime values belong in Sites configuration, never source.

Private pilot runtime setting: `FREESTOCK_PILOT_USER_ID` must equal the exact trusted Sites application identity. Country and US-person environment values are no longer used for product authorization. Freestock does not collect a separate eligibility questionnaire. This change does not open general funded registration or alter provider restrictions. Disabling entry/trading does not disable verified-account withdrawal preparation. No server signer exists. Transaction recovery stores only owner, request ID, nonce and transaction/account references on that browser; authoritative balances and confirmations come from the chain. Web Locks serialize cross-tab journal updates, and stale replies cannot overwrite successor requests.

UI switches use the user-provided Uiverse.io design by reglobby: a blue off state, green on state and animated glowing orb, with accessible controls and reduced-motion support.

Verified account creation references are remembered per wallet on this browser and rechecked against the chain on return. Live account balances refresh every 30 seconds while visible and idle. Reviews and pending wallet requests pause this refresh. Storage never substitutes for chain balances.

The compact header Connect Wallet button uses the same injected-wallet connection as Dashboard. It opens a wallet chooser, or explains how to open a wallet-enabled browser when no wallet is detected. The connected user continues to `/dashboard` to create or manage a live position. Connecting never submits a financial transaction. “Try it yourself” opens the simulation modal independently of the live account flow.

The homepage displays Apple, NVIDIA and Sandisk as illustrative floating artwork. The live purchase choices remain NVDA, AAPL, TSLA, GOOGL and SPY. Chain reads use bounded retry/backoff for transient failures, request-scoped in-flight coalescing, and safe upstream status diagnostics. Completed quotes and transaction previews are never cached or automatically submitted. `/api/live/status` reports the actual server-to-chain health without disclosing a provider URL or credentials.
