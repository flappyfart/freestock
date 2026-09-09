# Agentic Lending operations

Agentic Lending is a rule-based, wallet-approved product. It monitors one verified Steakhouse USDG position, explains whether to wait, retain gains or review stocks, and never sends financial transactions in the background.

## User flow

1. Connect the wallet profile and restore or create a live lending account.
2. Choose stocks and weights, minimum gains, a maximum purchase, an ETH fee ceiling and a fee percentage.
3. Save the plan. Optionally enable background monitoring at a preferred 15-minute, hourly or six-hour interval.
4. Read saved decisions and source timestamps. Use Check now for a fresh quote.
5. Review purchase opens the position form. Fresh preparation rechecks the saved revision, pause state, allocation, budget and fee limits. The wallet still approves the transaction. Returning to another manual action clears the Agentic handoff.

The 25 USDG default is an editable **recommendation purchase limit**, not a deposit cap. Existing V1/V2 contracts and recovery are unchanged. This release grants no onchain automation permission.

## Scheduler

`.github/workflows/agent-monitor.yml` calls the protected endpoint approximately every 15 minutes. GitHub schedules can be delayed or skipped, and inactive public repositories can have scheduled workflows disabled. Check the Actions page and dashboard health, not just the existence of the workflow file.

`AGENT_MONITOR_TOKEN` must match the secret in Sites and GitHub Actions. It grants access only to a bounded read-only monitoring run. It is not an RPC key, wallet key or transaction signer. Rotate both copies and deploy the environment change together. Never put either runtime secret in source, browser bundles or public workflow logs.

Each run processes at most three due plans sequentially, stops starting checks after two minutes, and holds a four-minute global lease. Each plan has a three-minute lease. This is a small-launch capacity of up to 12 checks/hour when scheduled runs occur on time, not a real-time or large-scale service. Expand to a dedicated queue/worker before inviting more users than this capacity supports. Manual checks are separate and available during scheduler delays.

The dashboard shows Running only with a recent successful heartbeat (45 minutes) or active run. Errors produce a degraded job and wait state; provider failures never fabricate a zero balance or send a transaction. Review failed GitHub Actions runs and `/api/live/agent/health`. This is not an external paging/on-call service.

## Fees and freshness

Read-only Chainlink proxy inputs on Robinhood Chain, chain ID 4663:

| Feed | Address | Published heartbeat |
| --- | --- | --- |
| ETH / USD | `0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9` | 86,400 seconds |
| USDG / USD | `0x61B7e5650328764B076A108EFF5fa7282a1B9aD2` | 86,400 seconds |

Configuration was checked against the [Chainlink directory](https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json) on 9 September 2026. [Robinhood oracle documentation](https://docs.robinhood.com/chain/oracles-and-price-feeds/) describes feed handling.

Reads pin a recent chain block, check the feed description, decimals, positive price, completed round and heartbeat, and recheck the block hash. Fee conversion divides ETH/USD by USDG/USD instead of assuming a dollar peg. Arithmetic rounds costs upward. Pool fees are counted once for the fee ratio, while quoted token output already includes them. Estimates exclude slippage, price movement and execution-time changes. Source timestamps are displayed; a newly requested estimate does not imply newly updated feed prices. The estimate and transaction review expire after 45 seconds.

These feeds value advisory fees. They are not an independently verified stock-price floor for autonomous execution. No sequencer-aware autonomous trading mechanism is claimed.

## Recovery and data

D1 retains the latest 100 decisions per position; the UI reads 50. Settings are wallet/account scoped and restore across devices after authentication. Saving uses optimistic revisions; conflicting devices must reload. Pause, edit and removal invalidate in-flight checks. A crashed check is retryable after lease expiry. Failed checks back off; final quotes are never stored as executable history.

`GET /api/live/agent` allows the owner to retrieve their saved plan and displayed decisions. The `remove` operation deletes the plan and retained decisions for that wallet/account. Removing a plan never withdraws funds or deletes the onchain account. Saved position and wallet-journal recovery remain available independently.

Managed D1 backup retention and restore access have **not been verified for this Sites account**, and no restore drill has been completed. Do not treat profile persistence as a tested backup. Before a broad launch, confirm backup/restore access with the hosting provider and exercise restoration in an isolated environment. Keep private database exports out of public GitHub artifacts.

## Release evidence and remaining checks

- Regression coverage includes ownership isolation, concurrent updates, lease recovery, pause/remove races, bounded history, scheduling overlap, fee arithmetic and final policy enforcement.
- An owner-approved account creation, 1 USDG deposit and full withdrawal were verified onchain on 9 September 2026. A funded stock conversion is still unverified.
- Validate a small number of real users before expanding: wallet connection, account restoration, saving/reloading a plan, understanding wait decisions, actual fee comparison, and withdrawal recovery. No participants have been contacted.
- Fully unattended purchases require a new opt-in contract permission design, independently bounded stock pricing, a funded executor, revocation/expiry and a separately verified funded lifecycle.
