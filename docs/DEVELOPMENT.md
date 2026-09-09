# Developer guide

[README](../README.md) · [Backend](BACKEND.md) · [Contracts](CONTRACTS.md)

## Prerequisites

- Node.js 22.13 or newer and npm.
- A Cloudflare-compatible Worker runtime with a D1 binding named `DB` for persisted features.
- A trusted authentication gateway for a hosted deployment. The current application integrates Sites identity.
- RPC connectivity for live read and preparation endpoints. Running the simulation does not require a funded wallet.

```sh
git clone https://github.com/flappyfart/freestock.git
cd freestock
npm ci
npm run dev
```

The stack is React + TypeScript on Vinext/Vite, with a Worker backend and D1. [`vite.config.ts`](../vite.config.ts) creates local binding configuration. The committed `.openai/hosting.json` contains project metadata and logical bindings; it is not a wallet secret. A fork must configure its own hosting project and database before publishing.

## Runtime configuration

| Setting | Purpose |
| --- | --- |
| `DB` | D1 binding used for simulation and saved live history |
| `ROBINHOOD_RPC_URL` | Optional RPC override; defaults to the configured public mainnet endpoint |
| `FREESTOCK_PILOT_USER_ID` | Private-pilot application identity; unset means no matching pilot participant |

Use ignored local environment files or your host's secret/configuration facility for actual values. Do not commit provider credentials, user identities, wallet keys or local database state. The server needs no wallet private key: signing happens in the browser wallet.

Application identity comes from [`app/chatgpt-auth.ts`](../app/chatgpt-auth.ts). A standalone public origin must not trust arbitrary client-supplied identity headers. Place it behind a gateway that authenticates users and strips/replaces those headers, or implement a server-validated session system before exposing persisted account APIs. Wallet verification alone does not secure application identity or its saved records.

## Local database and production-style preview

The ordered migrations in [`drizzle/`](../drizzle) create the legacy model, earnings simulation and live history tables. `npm run db:generate` generates migration files after a schema change; it does not apply them.

For a fresh local database, build first and apply the committed migrations in order:

```sh
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_tiresome_siren.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_faulty_betty_brant.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_polite_mystique.sql
npm run start -- --port 3011 --persist-to .wrangler/state
```

Use the same persistence directory for database setup and the server. Apply each migration once to an existing database; preserve migration order and back up data before remote schema changes. Production database creation and migration application are hosting tasks, not side effects of cloning the source.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Tests cover simulation arithmetic/idempotency, availability and launch policy, quotes and wallet plan validation, account references, recommendation rules, budgets, market-data handling and history reconciliation. Inspect [`tests/`](../tests) for the exact current coverage. A passing test suite is not evidence of a funded transaction or production readiness on its own.

With a local Worker running and migrations applied:

```sh
TEST_ORIGIN=http://localhost:3011 npm run test:api
TEST_ORIGIN=http://localhost:3011 node scripts/live-api-check.mjs
```

The API scripts enforce local HTTP origins and use test identity headers. Run the live API check with the private-pilot participant flag unset, as its expected status is disabled. Some live checks require healthy external RPC/quote services. Do not point these fixture runners at the hosted product or treat their injected headers as an authentication design.

```sh
npm run verify:integrations
```

The integration probe reads external providers. Results are time-dependent; retain timestamps and distinguish unavailable data from empty markets. Inspect the script before using it in CI, especially its output files.

## Contract artifacts

[`contracts/artifacts/account-standard-input.json`](../contracts/artifacts/account-standard-input.json) is the exact Solidity compiler input. Compile with Solidity 0.8.30 and its saved optimizer/viaIR/Cancun settings, then compare the ABI, bytecode, source hash and immutable references with the committed artifact. Do not substitute a newer compiler and assume equivalence.

The client verifies account deployment and fixed dependencies before preparing owner-approved actions. Changing source, artifacts, allowed addresses or transaction policy requires updating validation and meaningful regression coverage together. The historical fork reports include fake balances, accelerated time or constructed gains; scratch scripts mentioned in them are not all part of this repository.

## Contribution boundaries

- Keep integer token units explicit; USDG has six decimals and the enabled stock tokens have eighteen.
- Keep simulation balances and transactions separate from funded wallet state.
- Preserve browser signing and the owner-only contract boundary unless a new authorization design is explicitly reviewed and implemented.
- Reconcile uncertain receipts before allowing a retry that could duplicate a financial action.
- Add ordered migrations; do not rewrite already-applied history to hide schema changes.
- Document whether a feature is implemented, read-only, simulated, private-pilot or planned.
- Preserve third-party notices. Public visibility does not supply a missing repository-wide license.

See [the roadmap](PRODUCT-MILESTONES.md) for the next product and execution milestones.
