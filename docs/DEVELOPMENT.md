# Developer guide

[README](../README.md) · [Backend](BACKEND.md) · [Contracts](CONTRACTS.md)

## Prerequisites

- Node.js 22.13 or newer and npm.
- A Cloudflare-compatible Worker runtime with a D1 binding named `DB` for persisted features.
- HTTPS for hosted wallet-session cookies. Wallet authentication is implemented in the Worker; no separate application-login provider is required.
- RPC connectivity for live read and preparation endpoints. Running the simulation does not require a funded wallet.

```sh
git clone https://github.com/flappyfart/freestock.git
cd freestock
npm ci
npm run dev
```

The stack is React + TypeScript on Vinext/Vite, with a Worker backend and D1. [`vite.config.ts`](../vite.config.ts) creates local binding configuration. The committed `.openai/hosting.json` contains project metadata and logical bindings; it is not a wallet secret. A fork must configure its own hosting project and database before publishing.

## Runtime configuration

| Setting             | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `DB`                | D1 binding used for simulation and saved live history                     |
| `ROBINHOOD_RPC_URL` | Server-only provider endpoint; configure a dedicated provider for production. The public mainnet endpoint is the development fallback. |

Use ignored local environment files or your host's secret/configuration facility for actual values. Do not commit provider credentials, user identities, wallet keys or local database state. The server needs no wallet private key: signing happens in the browser wallet.

[Robinhood recommends Alchemy for production](https://docs.robinhood.com/chain/connecting/) and describes its public RPC as rate-limited. Create a Robinhood Chain **mainnet** app (chain ID 4663), store its full HTTPS endpoint as the secret `ROBINHOOD_RPC_URL`, and redeploy to apply the setting. Do not expose it through a `NEXT_PUBLIC_*` variable or commit a populated endpoint. Keep historical block access enabled for deployment verification and recovery. Check the provider's plan limits and usage before opening access broadly. The application uses this endpoint only for allowlisted reads and simulations; users still sign and submit transactions through their wallets.

Application identity comes from the verified wallet session in [`lib/wallet-auth.ts`](../lib/wallet-auth.ts). Never trust browser-supplied `oai-*` identity headers. Deploy the wallet challenge/session migration before serving this release. Cookies are host-only, HttpOnly and Secure; local browser tests use a trustworthy localhost origin. Wallet sign-in authenticates an address, while live routes separately enforce exact owner matching and onchain account verification.

## Local database and production-style preview

The ordered migrations in [`drizzle/`](../drizzle) create the legacy model, earnings simulation and live history tables. `npm run db:generate` generates migration files after a schema change; it does not apply them.

For a fresh local database, build first and apply the committed migrations in order:

```sh
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_tiresome_siren.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_faulty_betty_brant.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_polite_mystique.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_wallet_sessions.sql
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
TEST_ORIGIN=http://localhost:3011 node scripts/wallet-auth-api-check.mjs
```

The API scripts refuse hosted origins and generate disposable local wallet identities. They sign only free local authentication messages; they never submit public financial transactions or use personal wallet keys. They verify wallet session isolation, denial of anonymous/forged identity headers, private responses and exact owner binding. Live read checks require healthy external RPC/quote services. The simulator has an independent browser session that cannot access live-wallet routes.

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
- Document whether a feature is implemented, read-only, simulated, live or planned.
- Preserve third-party notices. Public visibility does not supply a missing repository-wide license.

See [the roadmap](PRODUCT-MILESTONES.md) for the next product and execution milestones.
