# Stock-lending market data

Freestock lists AAPL, GOOGL, NVDA, SPY and TSLA Morpho loan-asset markets on Robinhood Chain (4663). Borrower collateral is USDG. The user selected **read-only market data**, so this release adds no stock approvals, deposits, borrowing or withdrawals. The existing USDG pilot is unchanged.

## Registry and verification

`lib/stock-lending-registry.json` pins full market parameters. Each ID was recomputed and matched to Morpho `idToMarketParams`; token addresses matched Robinhood’s canonical registry. All loan tokens have 18 decimals, USDG has 6, and LLTV is 62.5%.

At block 58,196,418, timestamp 2026-09-09 02:39:15 UTC, all five markets had zero supplied and borrowed assets. Morpho’s API also reported zero seven-day supply APY. These are dated observations, not permanent rates or a yield promise.

Block hash: `0xfa94fc59ab2529b08f35267432cf72a524cc631b269d05456ec66ea52f266dba`.

## Data contract

`GET /api/stock-lending/markets` returns checked stock identities, token amounts as exact decimal strings, seven-day supply APY, independent state/rate indexed blocks, fetch time and availability. `executionEnabled` is always false. The hardcoded upstream is Morpho; clients cannot supply arbitrary URLs. Reads time out, refuse redirects and validate chain, market identity, nonnegative uint256 amounts and available-liquidity arithmetic. Missing values stay null. Valid balances remain available when a rate read fails. Completed responses cache for 60 seconds when complete and 15 seconds otherwise; in-flight Worker promises are not shared between requests.

Home and Dashboard use a read-only client panel. Retained responses are labeled when refresh fails. Indexed block references are included on each source link. API freshness is not proof of indexer freshness, and token quantities must not be summed across stocks or described as dollars.

## Local behavior checks

`stock-lending-local-checks.json` records 60 successful assertions across five markets on an Anvil fork using synthetic funds and newly generated local wallets. Each market exercised supply, exact approval consumption, unauthorized withdrawal rejection, collateralized borrowing, overborrow rejection, liquidity-limited withdrawal, repayment after a modeled day and full withdrawal including borrower-paid interest. No public transaction, privileged impersonation or token-gate override was used. A successful local scenario does not establish future demand or financial safety.

## Price adapter findings

Exact oracle outputs reconciled for all five markets. The stock-token feed already accounts for the corporate-action multiplier. The inspected adapters tolerate stock prices up to four days old and USDG prices up to 26 hours old. Two-day-old stock prices were accepted; primary and secondary stock proxies shared the same aggregator. NVDA negative-read scenarios rejected paused tokens, invalid or incomplete prices, excessive ages and divergence, and repriced a USDG depeg.

Verified adapter source was unavailable from checked services; no official Robinhood sequencer uptime feed was established. This was a bounded contract/data review, not a full source review. These limitations and empty markets informed the data-only choice.

## Sources

- [Mast lending announcement](https://mast.bond/journal/lending-is-live-on-mast)
- [Mast markets](https://mast.bond/lend)
- [Robinhood asset registry](https://api.robinhood.com/rhj/assets)
- [Morpho mechanics](https://docs.morpho.org/learn/concepts/blue/)
- [Chainlink Robinhood feed registry](https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json)

Each market’s live Morpho state URL is constructed from its exact ID in the registry, using `/v0/blue/markets/4663:ID/state`; rates use `/apy-averages`. User-facing explanations are in `/learn#stock-lending` and `/docs#stock-lending`.
