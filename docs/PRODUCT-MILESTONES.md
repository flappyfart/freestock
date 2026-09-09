# Freestock: prove the earnings-to-stock experience

Updated 9 September 2026 UTC. This is a delivery and validation plan, not a claim of a unique product or completed user research.

## First release: implemented

- Home explains the stablecoin-lending-to-stock-token journey and leads into the wallet dashboard or a separate simulation modal.
- Demo setup separates the earning source from Buy stocks, Reinvest and Split both. The summary expresses each destination as a share of all new earnings after loss recovery; basket weights do not allocate deposited capital.
- Demo conversions still use an amount threshold and fixed illustrative prices, excluding conversion costs. Full reinvestment does not automatically buy stocks from a prior pending balance. Existing saved-state and idempotency formats are preserved.
- Live account review shows position value, principal baseline, available surplus, rounding reserve and a recovery shortfall when below the baseline. Direct transfers count as surplus, so this is not an interest-provenance ledger.
- Purchase review shows estimated and minimum stock receipts, included pool fee and separate ETH gas estimate. The displayed pool fee and quote/minimum relationship are validated against the reviewed transaction. Existing owner-only permissions are unchanged.
- Confirmed purchases show actual received tokens, amount spent, block/time, an explorer link and a downloadable receipt. Portfolio Activity saves user-scoped positions and chain-reconciled records, with bounded historical import and page exports.
- Learn and Docs explain the delivered behavior and its limits. The dated [competitor comparison](COMPETITOR-EVIDENCE.md) and [validation kit](USER-VALIDATION-KIT.md) are ready for planning. No participants have been contacted.

## Next: validate the narrow customer need

Agentic Lending now ships in recommendation mode: one verified account, an explicit stock/retention plan, a conversion minimum, an ETH gas budget, decision reasons and a manual-review handoff. It is rule-based and has no model connection, background execution or cross-pool allocator. Use this surface to test comprehension and the usefulness of waiting/holding/conversion advice. Gas-plus-pool fees are now compared in USDG; a neutral cash alternative still needs the study worksheet described below.

Use eight people who already manage a stablecoin lending position. Record their actual position size, available earnings, last earnings decision and real costs. Compare receiving USDG, reinvesting and buying stocks without predicting future stock returns. The current modal supports the stocks/reinvest/split demonstration; the cash alternative and proposed fee-limit controls in the study need a neutral comparison worksheet before sessions.

Measure whether participants understand the distinction between deposited capital and available gains, choose stocks after seeing costs, set an allocation without help and return to the plan a week later. Use the explicit scoring and decision rules in the kit. Compliments and stated willingness to use the product are not repeat-use evidence.

## Then: one dependable live lifecycle

The owner completes an explicitly approved deposit, gain conversion or gain reservation, and withdrawal, with receipts reconciled to the account. Builder-run local-fork tests are not evidence of this funded production lifecycle. Use current quotes and actual ETH fees; no background job or agent may move funds without separate user authorization.

Persistent, chain-reconciled transaction history is implemented, including pending, replaced, reverted and reorganized transactions. Stock receipts are attributed to account events, not the wallet's entire holdings. This does not establish a lifetime earnings ledger: direct transfers are outside the event scan and totals cover the displayed page. Validate the owner-approved funded lifecycle next.

## After validation: bounded automation

The current contract is owner-only and has no keeper permission. Real auto-conversion needs an explicit authorization design and new execution path; a switch or scheduled job does not provide that authority.

Define each rule's owner, supported account, approved tokens and allocation, minimum available gains, total cost ceiling, maximum spend per execution/period, expiry and revocation. Cost comparison must include fees paid from the wallet as well as the converted budget, using timestamped valuation when comparing ETH to USDG. Do not double-count pool fees already reflected in a quote.

Required behavior: below-baseline losses recover first; small or uneconomic conversions wait; unavailable prices/liquidity postpone execution; paused or revoked rules cannot submit new transactions. Persist the exact reason for skipped actions. Bound retries, reconcile receipts and serialize executions per account. Test restart, replacement and revocation during a pending request before any funded activation.

## Later: expand sources

Add another lending adapter only when its gain accounting, liquidity, permissions and receipt semantics are verified. Connecting an arbitrary existing position is not currently supported. Staking, leveraged LP execution and stock-lending transactions remain outside the live account; stock lending is read-only data.

Success is a repeatable customer outcome with understandable costs and reliable execution. Do not claim first, only, guaranteed income or principal protection.

## Public access update — 9 September 2026

The single-participant application allowlist has been removed. Wallet-authenticated users can prepare owner-approved account creation, deposits, stock purchases, compounding and withdrawals. Public browsing and real wallet execution remain separate from the simulator. New V2 positions remove the Freestock deposit cap; older V1 positions retain their immutable limit. Free wallet-message confirmation creates a profile without a separate application login. Owner checks, receipt checks and manual transaction signing remain in place. Website: https://tryfreestock.com/. X: https://x.com/tryfreestock. Subsequently, the owner approved account creation, a 1 USDG deposit and full withdrawal, verified against receipts. A funded stock conversion remains to be checked.

## Monitoring release — 9 September 2026

Implemented: wallet-profile plans, persistent decision history, scheduled read-only checks, optimistic revisions, leases, pause invalidation, bounded retries, per-recommendation purchase ceilings and gas-plus-pool fee limits. Recommendation mode is now usable across devices. Unattended financial execution remains a separate development step: V2 contracts have no executor permission, and no funded transaction signer has been configured.
