# Freestock: prove the earnings-to-stock experience

Updated 9 September 2026 UTC. This is a delivery and validation plan, not a claim of a unique product or completed user research.

## First release: implemented

- Home explains the stablecoin-lending-to-stock-token journey and leads into the wallet dashboard or a separate simulation modal.
- Demo setup separates the earning source from Buy stocks, Reinvest and Split both. The summary expresses each destination as a share of all new earnings after loss recovery; basket weights do not allocate deposited capital.
- Demo conversions still use an amount threshold and fixed illustrative prices, excluding conversion costs. Full reinvestment does not automatically buy stocks from a prior pending balance. Existing saved-state and idempotency formats are preserved.
- Live account review shows position value, principal baseline, available surplus, rounding reserve and a recovery shortfall when below the baseline. Direct transfers count as surplus, so this is not an interest-provenance ledger.
- Purchase review shows estimated and minimum stock receipts, included pool fee and separate ETH gas estimate. The displayed pool fee and quote/minimum relationship are validated against the reviewed transaction. Existing owner-only permissions are unchanged.
- Confirmed purchases show actual received tokens, amount spent, block/time, an explorer link and a downloadable receipt. The latest receipt is session-only; the chain retains the transaction record.
- Learn and Docs explain the delivered behavior and its limits. The dated [competitor comparison](COMPETITOR-EVIDENCE.md) and [validation kit](USER-VALIDATION-KIT.md) are ready for planning. No participants have been contacted.

## Next: validate the narrow customer need

Agentic Lending now ships in recommendation mode: one verified account, an explicit stock/retention plan, a conversion minimum, an ETH gas budget, decision reasons and a manual-review handoff. It is rule-based and has no model connection, background execution or cross-pool allocator. Use this surface to test comprehension and the usefulness of waiting/holding/conversion advice. An all-in USDG cost comparison and neutral cash alternative still need the study worksheet described below.

Use eight people who already manage a stablecoin lending position. Record their actual position size, available earnings, last earnings decision and real costs. Compare receiving USDG, reinvesting and buying stocks without predicting future stock returns. The current modal supports the stocks/reinvest/split demonstration; the cash alternative and proposed fee-limit controls in the study need a neutral comparison worksheet before sessions.

Measure whether participants understand the distinction between deposited capital and available gains, choose stocks after seeing costs, set an allocation without help and return to the plan a week later. Use the explicit scoring and decision rules in the kit. Compliments and stated willingness to use the product are not repeat-use evidence.

## Then: one dependable live lifecycle

The owner completes an explicitly approved deposit, gain conversion or gain reservation, and withdrawal, with receipts reconciled to the account. Builder-run local-fork tests are not evidence of this funded production lifecycle. Use current quotes and actual ETH fees; no background job or agent may move funds without separate user authorization.

Build a persistent, chain-reconciled conversion history before describing an earnings ledger. Attribute received stocks to confirmed account events, not the wallet's entire holdings. Support pending, replaced, reverted and reorganized transactions without duplicate spending.

## After validation: bounded automation

The current contract is owner-only and has no keeper permission. Real auto-conversion needs an explicit authorization design and new execution path; a switch or scheduled job does not provide that authority.

Define each rule's owner, supported account, approved tokens and allocation, minimum available gains, total cost ceiling, maximum spend per execution/period, expiry and revocation. Cost comparison must include fees paid from the wallet as well as the converted budget, using timestamped valuation when comparing ETH to USDG. Do not double-count pool fees already reflected in a quote.

Required behavior: below-baseline losses recover first; small or uneconomic conversions wait; unavailable prices/liquidity postpone execution; paused or revoked rules cannot submit new transactions. Persist the exact reason for skipped actions. Bound retries, reconcile receipts and serialize executions per account. Test restart, replacement and revocation during a pending request before any funded activation.

## Later: expand sources

Add another lending adapter only when its gain accounting, liquidity, permissions and receipt semantics are verified. Connecting an arbitrary existing position is not currently supported. Staking, leveraged LP execution and stock-lending transactions remain outside the live pilot; stock lending is read-only data.

Success is a repeatable customer outcome with understandable costs and reliable execution. Do not claim first, only, guaranteed income or principal protection.
