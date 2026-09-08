# Freestock: paper-beta accounting and draw review

Date: 2026-09-08. This is an implementation design review, not an audit or a conclusion that live deposits can be enabled.

The attached conversation is research context. Its specific vault address, network configuration, and access conclusions have not been independently tested by this review. The actionable build boundary is a paper beta with a real accounting model, explicit simulated balances and draws, and adapters that remain disabled until their integration evidence exists.

## 1. Paper beta contract

- Every screen and transaction receipt identifies the environment as **Paper beta**. Paper USDG, paper yield, virtual stock awards, simulated quotes, and simulated randomness are distinct from deposits, realized revenue, executed stock purchases, or VRF proofs.
- No wallet approval, fund transfer, stock purchase, or live draw request occurs in this environment. A wallet address alone is not authenticated identity.
- The simulator may model yield using a named scenario. Its rate is an assumption with a timestamp and is not an advertised vault APY or product return.
- A user action is persisted as a typed event with an immutable ID. The displayed state is a projection of those events. Repeating the same action ID returns the original receipt; it cannot create a second deposit, withdrawal, prize, or fee.
- Monetary values are integer base units. Token decimals are explicit configuration; a paper 6-decimal convention is acceptable if labeled as a simulation convention. JSON carries integers as decimal strings. UI currency rounding must never alter ledger arithmetic.

## 2. Entry accounting

Recommended initial rule: proportional asset-seconds, with no minimum-ticket rounding, referral multipliers, or per-wallet bonuses. This yields a simple, wallet-splitting-invariant model; it is a proposed product rule rather than a finding about the attached design.

For epoch `e = [start, end)` and participant `i`:

```
weight[i,e] = integral(eligibleBalance[i,t], start, end)
totalWeight[e] = sum(weight[i,e])
probability[i,e] = weight[i,e] / totalWeight[e]
```

Store the weight in **base-unit seconds**, not rounded dollars or integer tickets. A ticket-like display can divide the value for readability while preserving the exact underlying weight.

On each mutation at trusted time `t`, accrue the old balance through `min(t,end)` before applying the mutation. Accrual only starts at `max(lastAccrued,start)`. Reject backwards timestamps. The browser must not supply authoritative event time. Advance across every epoch boundary, including when the service resumes after several missed draws. A display render must not itself mint interest or entries.

Rules that remove ambiguity:

1. A deposit at `end` has zero weight in the closing epoch and begins earning in the next epoch.
2. A deposit and withdrawal at the same timestamp earn zero intervening weight, regardless of their size.
3. A withdrawal removes future eligible balance; accrued weight stays in the historical epoch. Withdrawal never erases valid past entries or a pending win.
4. For a queued withdrawal, the paper model stops future entry accrual when the withdrawal request reserves the amount. Outstanding principal remains recorded until the payout completes. Production must publish whether queued funds remain at risk and how cancellation restores eligibility.
5. Canceled requests restore eligibility from the cancellation timestamp, not retroactively. A failed payout does not silently cancel the request or make its balance spendable again.
6. Account-to-account transfers are disabled initially. If introduced, accrue both sides first and conserve aggregate balance and aggregate historical weight.
7. Current-epoch probability is labeled an estimate, since other deposits and elapsed time can change the denominator. A closed snapshot probability is exact under the published rules.
8. Withdrawal liquidity and draw progress are separate: an outstanding draw must not itself lock an otherwise permitted withdrawal.

Time weighting reduces instantaneous capital entry, but it does not prove unique identity or prevent all economically funded last-minute entries. Avoid claiming that it does.

## 3. Capital, yield, and prize accounting

Maintain separate accounts for depositor capital, invested vault assets, withdrawn/queued capital, realized-yield cash, protocol operating funds, reserved prize cash, and awards owed. Each economic event must conserve assets: it moves value between accounts or records a specifically sourced inflow, expense, or loss.

Paper beta invariants:

- Total outstanding capital equals accepted deposits less completed principal payouts, adjusted only by an explicit loss event if loss modeling is implemented. A withdrawal request does not count as a completed payout.
- `eligibleCapital + queuedCapital` equals outstanding capital under the chosen entry rule.
- Deposits never increase realized yield or prize budget.
- A vault redemption is not entirely yield. Separate recovered capital from the return on it; the same harvest ID may be recognized only once.
- Accrued or estimated yield, displayed APY, unclaimed rewards, and unrealized reward-token appreciation never create spendable prize cash.
- Prize reservations atomically reduce unreserved realized-yield cash. Each draw owns one reservation; later draws cannot spend it.
- Expenses are deducted once and traced to receipts. A forecast of remaining execution costs is reserved before choosing a prize budget.
- Paid prizes and earned yield are distinct totals. Prize payments cannot be added to portfolio deposits or reported again as fresh yield.
- Budgets, balances, and costs cannot become negative; invalid operations fail atomically.

A useful safety bound, after reconciling assets and avoiding double-counted obligations:

```
newPrizeBudget <= min(
  unreserved cash from realized net return,
  max(0, conservative unreserved assets
         - outstanding capital reference
         - unpaid operating liabilities
         - required reserve)
)
```

Previously reserved prize assets are excluded from both inputs. Pending withdrawal capital is already part of the outstanding capital reference and must not be subtracted twice. Keep unknown redemption proceeds and unsupported valuations outside the amount available to spend. Realized losses and prior unrecovered impairments must be covered before recognizing new distributable return.

The capital reference is an accounting hurdle, **not a 1:1 redemption promise**. A live product additionally needs a share/NAV ledger and a published loss-allocation and queue-settlement policy. If assets fall below that reference, awarding new prizes stops. A haircut must not silently erase the historical loss hurdle and immediately let the next recovery count as distributable profit. Do not present a fixed-balance paper model as a completed live loss-allocation implementation.

Morpho V2 can restrict assets/shares through four gates, and its `maxDeposit`, `maxMint`, `maxWithdraw`, and `maxRedeem` deliberately return zero. These results do not independently determine whether a particular operation is possible. Its liquidity and exposure mechanisms also require integration-specific analysis. [Morpho V2 contract documentation](https://docs.morpho.org/developers/contracts/morpho-vaults-v2/), [Morpho gates](https://docs.morpho.org/curate/concepts/gates/), [Morpho V2 concepts](https://docs.morpho.org/learn/concepts/vault-v2/).

## 4. Draw lifecycle and immutable commitments

Use an explicit state machine; do not infer status from whether a winner field exists:

```
OPEN -> CLOSED -> REQUESTED -> RANDOMNESS_STORED
     -> RELAY_PENDING -> RANDOMNESS_ACCEPTED -> AWARDED -> CLAIMED
```

`RELAY_PENDING` is retryable. Stock fulfillment may separately be `UNPLACED`, `PENDING`, `PARTIAL`, `FAILED_RETRYABLE`, or `DELIVERED`. Randomness, winner selection, and stock fulfillment must not be compressed into one external call. `SKIPPED` is permitted before requesting randomness when there are no entries or no spendable prize budget. There is no administrative reroll after a request or result.

Close atomically persists the epoch, ordered participant/weight snapshot, total weight, reserved award budget, stock catalog or single chosen instrument, allocation rules, rounding/dust policy, claim/fallback terms, configuration version, and snapshot hash. The hash must use a canonical serialization. Never hash ordinary JSON without specifying key and number encoding. Freeze all user-significant inputs before requesting randomness. [Chainlink VRF security considerations](https://docs.chain.link/vrf/v2-5/security).

The draw key must be unique across deployments and networks, for example a hash of protocol version, destination chain ID, destination pool address, epoch, and immutable snapshot hash. Store CCIP selectors separately from chain IDs.

The Arbitrum VRF request maps `requestId -> drawKey + snapshotHash`. A fulfillment records the result against that mapping, not against “the current draw.” The callback must have bounded storage work and no stock purchase, token transfer, unbounded loop, or CCIP send. Chainlink says fulfillment callbacks are not retried on revert and requests can fulfill out of order. Retain the authenticated coordinator check provided by the supported consumer base. [Chainlink VRF security considerations](https://docs.chain.link/vrf/v2-5/security).

A separate relay uses the persisted result. It may retry a failed send but cannot request new randomness. Its authenticated envelope includes version, draw key, snapshot hash, source request ID, random word, source and destination identity. On receipt validate the configured CCIP router, source chain selector, expected sender contract, destination context, and frozen snapshot. Chainlink's receiver example illustrates source-chain and sender allowlists; the example is not itself production-reviewed application code. [Chainlink CCIP arbitrary-data example](https://docs.chain.link/ccip/tutorials/evm/send-arbitrary-data).

Deduplicate both **transport message ID** and **business draw key**. A retried relay can have a new transport ID yet carry the same result. Identical duplicates do nothing; a conflicting result for the same draw is rejected and alerted. Store the accepted result before performing any payout. Make winner settlement and claim consumption atomic and independently idempotent.

For one weighted winner, choose an integer in `[0,totalWeight)` and select the first cumulative interval containing it. Use rejection sampling for an exactly uniform range; plain modulo is slightly biased unless the range divides the random-word domain. Derive retry samples deterministically from the stored VRF word with domain separation and a counter; do not ask for a new VRF response. Publish the sampling implementation and bound totals to the supported integer domain. The paper version uses a reproducible test seed or browser cryptographic randomness and labels either source as simulated. Neither is a VRF proof.

If drawing multiple awards or random stock identities, freeze whether winners may repeat and whether stock odds are equal or weighted. Use distinct deterministic domains for winner, stock selection, and prize index. A provider outage, closed market, price jump, failed KYC, or unavailable instrument cannot authorize choosing a different winner. Precommit the retry/refund/fallback procedure before entries accrue.

## 5. Essential vectors and failure cases

Use exact integers; these expected weights are written in dollars-seconds only for readability.

| Case | Input | Expected result |
|---|---|---|
| Full versus half epoch | 100-second epoch; A deposits $100 at 0; B deposits $100 at 50 | A weight 10,000; B 5,000; odds 2/3 and 1/3 |
| Partial withdrawal | A deposits $100 at 0, withdraws $40 at 25, closes at 100 | Weight 2,500 + 4,500 = 7,000; capital $60 |
| Flash-like action | Deposit and withdrawal at time 40 | Zero additional weight |
| Boundary | Deposit at exact closing time 100 | Zero weight in `[0,100)` |
| Wallet split | One $100 account versus ten $10 accounts with the same event times | Identical aggregate weight and aggregate odds |
| Queue | $100 at 0; request $40 withdrawal at 25; payout at 80 | Weight 7,000; queue remains $40 until payout; no double withdrawal |
| Queue cancellation | Same request, canceled at 50 | Weight 2,500 + 1,500 + 5,000 = 9,000 |
| Closed snapshot | Close, then deposit, withdraw, or change display preferences | Closed weights/hash and winner unchanged |
| Empty epoch | Total weight 0 | Skipped before request; no modulo by zero; no invented winner |
| No cash yield | Large APY estimate, zero recognized harvest | Prize budget 0 |
| Costs | Realized return $10, settled costs $2, future-cost reserve $1 | At most $7 available, subject to solvency and other reservations |
| Principal only | Deposit $1,000, then redeem $1,000 of capital | Yield and prize budget unchanged |
| Impairment | Capital reference $1,000; conservative unreserved assets $990 | New prize budget 0 even if a cash balance is visible |
| Duplicate request | Same deposit/harvest/claim id submitted twice | One economic effect and the same receipt |
| Idempotency conflict | Same action ID reused with a different amount | Reject conflict, do not return false success |
| Delivery reordering | Draw B fulfills before A | Both resolve by their own request IDs |
| Relay failure | Fulfillment succeeds; CCIP send fails | Stored randomness preserved; retry uses it |
| Replayed relay | Same result arrives under a different message ID | No second award |
| Conflicting relay | Different word/snapshot for an accepted draw | Reject and alert |
| Cumulative bounds | Weights `[2,3]`, tickets `0,1,2,4` | Winners A,A,B,B; ticket 5 rejected |
| Range bias | Toy 8-bit source and total weight 10 | Reject samples 250–255; map 0–249 uniformly |
| Concurrency | Two withdrawals race for one balance | At most available capital reserved; no negative balance |
| Interrupted order | Provider accepted an order but response was lost | Query by stable client order ID before any retry |
| Claim race | Two claim attempts execute together | One debit/transfer and one successful claim |
| Multi-epoch resume | No user events for three periods | Accrue each period independently; do not move all weight into the latest |
| Clock/precision | Backwards time, NaN, infinity, exponent strings, excess decimals, integer overflow | Reject; no ledger mutation |

Property checks should cover conservation, wallet splitting, monotonic historical weights, immutable closed draws, replay safety, bounded payouts, and event-replay equivalence. Avoid tests that simply restate UI text or duplicate implementation formulas.

## 6. Production release gates

These gates follow from the proposed real-money integrations. A polished frontend does not complete them.

1. **Vault access evidence:** identify the exact deployed implementation, underlying asset and decimals, gate contracts and administrator powers at a recorded block. Run an unprivileged-contract deposit → shares → redemption round trip on a mainnet fork without modifying access controls. Preserve addresses, traces, block, fees, slippage, and actual balance deltas. Test pause, restriction changes, loss, illiquidity, and emergency exit paths.
2. **Authenticated randomness transport:** verify current official deployments and runtime route support; record fee quotes and execute an end-to-end request, fulfillment, relay, receive, and award with the application's own contracts. Test wrong sender/router, duplicate/reordered delivery, failed callback risk, delayed finality, insufficient subscription/relay funding, and retry operations. Choose finality/confirmation policy for the value at risk.
3. **Stock-delivery contract:** name the provider or token issuer, establish executable access, instrument identity, custody/ownership representation, trading hours, quote expiry/slippage, fractional precision, fees, and redemption/transfer rules. Reconcile an actual authorized order and delivery before using copy such as “you own this stock.” Do not equate a token symbol or mock portfolio row with securities ownership.
4. **Accounting and loss policy:** resolve share/NAV pricing, realized-return recognition, reward conversion, loss carryforward, queue settlement, expense allocation, rounding, and pre-funded prize custody. Reconcile each ledger total against external balances and provider records, including failures and partial fills.
5. **Security and operational review:** implement authenticated users, authorization on every mutation, transaction-bound idempotency, concurrency control, protected secrets, reentrancy checks, upgrade/role governance, least-privilege keys, logging, alerting, backups/restore rehearsal, rate limits, and incident controls. Obtain independent contract/application review and resolve critical findings before a live deposit flag can be enabled.
6. **Product/legal authorization:** obtain qualified review of the specific prize, savings/lending, eligibility, custody, stock, tax, jurisdiction, and distribution model before deciding where the product can be offered. This review does not determine legal classification or eligibility.
7. **Honest launch switch:** live mode is disabled by default and requires validated configuration plus an explicit deployment approval. The initial build may expose a readiness page showing evidence as pending; it must not mark a gate passed because an adapter interface or unit test exists.

Recommended immediate build: finish the paper ledger and draw state machine, wire the product UI to persisted paper state, add the vectors above, and publish a truthful readiness view. Keep live integrations disabled while the evidence gates are completed.
