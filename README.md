# freestock

Private DeFi practice product for a planned eligible non-US audience. Users can create lending scenarios, model leveraged LP exposure, choose single Stock Tokens or custom baskets, auto-convert simulated earnings, compound them into DeFi, or split between both. The requested white/cobalt design, transparent floating stock artwork, dither background and NVIDIA arrival intro remain in place.

**No real deposits, lending, staking, LP transactions, borrowing or stock purchases are enabled.** Automation runs only when the user explicitly advances the simulation. The app is neither public financial infrastructure nor a background trading service.

## Working routes

- `/`: persistent practice positions, allocation rules, simulation controls, holdings and read-only market catalogue.
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

Historical documents are labeled as superseded. `/learn` and `/docs` describe the active product. Real activation needs verified strategy adapters, authorized transaction execution, current executable quotes, eligibility, cost/debt limits and reconciliation; there is no switch that makes the practice engine handle real funds.
