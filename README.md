# freestock

Private USDG lending and Stock Token wallet pilot with a separate practice account for exploring DeFi scenarios. Users can create lending scenarios, model leveraged LP exposure, choose single Stock Tokens or custom baskets, auto-convert simulated earnings, compound them into DeFi, or split between both. The requested white/cobalt design, transparent floating stock artwork, dither background and NVIDIA arrival intro remain in place.

**The homepage leads to your live account and keeps the simulator under “Try it yourself.”** `/live` offers the same private, participant-restricted wallet pilot for USDG lending and purchases of NVIDIA, Apple, Tesla, Alphabet and SPY tokens from available gains. Each deployment, approval, deposit, compound, purchase and withdrawal requires an explicit wallet transaction. No agent has submitted public transactions or moved real funds. Background automation, staking and leveraged LP execution are not enabled.

## Working routes

- `/`: live wallet account, “Try it yourself” practice box, collapsible saved practice results and read-only market catalogue.
- `/live`: wallet connection, actual chain balances, Uniswap V3 quotes, direct deposit simulations and yield-account setup plus reviewed wallet transactions. The read-only checks request no signatures; the separately labeled wallet pilot opens a wallet confirmation only after an explicit review action.
- `/learn`: plain-English explanations, earnings sources, timing, leverage, tokens and future possibilities.
- `/docs`: current capability matrix, exact model mechanics, sources and execution boundaries.
- `/transparency`: saved ledger and JSON export, including exact purchase allocations and modeled prices.
- `/fairness`: redirects to earnings transparency. The draw/prize concept has been retired.

## Accounting and automation

A new DeFi account starts with 10,000 practice USDG. Money uses integer micro-USDG; basket weighting uses BigInt intermediates. `lib/earn-engine.ts` applies pure state transitions. Losing scenarios consume pending earnings then principal; later gains first recover lost principal. A selected percentage of remaining surplus compounds into the position, and the remainder waits for manual or threshold-based stock conversion. Closing returns capital; earnings below the 1 USDG conversion minimum also return to the wallet. Other pending earnings remain convertible after closure.

Lending converts the observed seven-day vault APY to an effective daily rate, then accrues linearly within each simulation step. Fractions below one micro-USDG carry into the next step. Compounding happens at step boundaries. The observed rate is fixed for that position, not treated as a forecast or live accrual.

The LP model uses leverage, fee APR, borrowing APR, annual costs on exposure and an optional LP value shock. Leverage resets to the selected multiple each step without rebalancing costs. Liquidation thresholds, real collateral mechanics and withdrawal queues are not simulated. Stocks are purchased at disclosed fixed illustrative prices, assuming 1 USDG = $1 and zero gas/spread/trading fees. These are approximate practice token quantities, not real holdings or current valuations.

## Data

`lib/markets.ts` reads current balances and seven-day rates for one tracked Steakhouse USDG vault and five previously verified listed Morpho USDG markets on Robinhood Chain 4663. Directory membership was checked September 8, 2026. This is an explicit subset; it does not claim all-chain pool coverage. Vault and market assets overlap and are never added together. Refresh failure returns the dated snapshot with a prominent status. Read-only observations do not establish an executable route. See the in-app Docs for direct source links.

## Persistence and requests

`lib/earn-store.ts` saves independent per-owner state in `earn_accounts` and permanent request receipts in `earn_commands`. A compare-and-swap update and receipt insertion share an atomic D1 batch. Duplicate retries return the original receipt and current state. Server routes obtain account identity from trusted Sites dispatch headers, validate same-origin requests, bound streamed bodies to 4 KB and return uncached private responses.

The original `accounts`/`commands` tables and old engine tests are retained for historical data compatibility. New accounts never borrow funds from retired prize accounts. `/api/commands` returns 410 and no longer changes old prize state. Never expose an untrusted raw Worker origin that accepts forged dispatcher identity headers.

## Local development and validation

Node 22.13+ and npm are required. Run `npm ci`, `npm run dev`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. Sites supplies local sign-in. D1 schema comes from `db/schema.ts` and append-only Drizzle migrations in `drizzle/`; Sites applies them on deploy.

`TEST_ORIGIN=http://localhost:3011 npm run test:api` only accepts local origins, refuses redirects, and creates isolated test identities. Use the same local D1 persistence directory for migrations and the test Worker. Tests cover account isolation, request validation, duplicate/concurrent actions, compounding, baskets, loss recovery, closure and retired routes. No hosted accounts are mutated by these checks.

Historical documents are labeled as superseded. `/learn` and `/docs` describe the active product. The practice engine never handles real funds. The wallet pilot verifies the exact deployment, owner, dependencies and receipts. A specific signed-in participant is enabled through runtime configuration; country declarations are not identity verification or public launch approval.

## First live integration

See `docs/LIVE-PILOT.md` for verified dependencies, account semantics, fork evidence and exact activation boundaries. `contracts/src/FreestockYieldAccount.sol` is compiled reproducibly in `contracts/artifacts`. No shared mainnet account has been deployed by the builder. Each participant creates their own account directly from an EOA wallet. The first participant declared Norway residence/location and non-US-person status; eligibility is not inferred from residence alone. No API key is required for the direct AMM route. Set `ROBINHOOD_RPC_URL` to an HTTPS production RPC for dedicated capacity; otherwise reads use the official public RPC and fail closed on provider errors. Runtime values belong in Sites configuration, never source.

Private pilot runtime settings: `FREESTOCK_PILOT_USER_ID` must equal the exact trusted Sites application identity, `FREESTOCK_PILOT_COUNTRY=NO`, and `FREESTOCK_PILOT_US_PERSON=no`. Configure these only for the declared participant. The public availability self-check never grants pilot access. Disabling entry/trading does not disable verified-account withdrawal preparation. No server signer exists. Transaction recovery stores only owner, request ID, nonce and transaction/account references on that browser; authoritative balances and confirmations come from the chain. Web Locks serialize cross-tab journal updates, and stale replies cannot overwrite successor requests.

UI switches use the user-provided Uiverse.io design by reglobby: a blue off state, green on state and animated glowing orb, with accessible controls and reduced-motion support.

Verified account creation references are remembered per wallet on this browser and rechecked against the chain on return. Live account balances refresh every 30 seconds while visible and idle. Reviews and pending wallet requests pause this refresh. Storage never substitutes for chain balances.
