> Historical record: this document describes the retired prize preview. See README.md and the in-app Docs for the active DeFi product.

# D1 paper-beta concurrency review

The proposed versioned account update plus conditional command receipt insertion is sound for one-account paper mutations **if the insertion uses a normal uniqueness-enforcing INSERT and every mutation is in the same batch**. This is a design review, not a review of the finished implementation or deployed D1 behavior.

Cloudflare documents that a D1 batch executes its statements sequentially as a transaction and rolls the sequence back on statement failure. A zero-row conditional UPDATE is not a statement failure, so the guarded INSERT and subsequent receipt check are essential. [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/).

## Must handle

1. **Never silently ignore command uniqueness conflicts.** `INSERT OR IGNORE` / `ON CONFLICT DO NOTHING` can allow the account mutation to commit after a missed duplicate lookup. Keep a plain `INSERT` so the duplicate command causes the whole batch to roll back. Alternatively an independently proven transaction guard can prevent the mutation, but do not introduce that variation without tests.
2. **Recover a same-key race through the stored receipt.** Two attempts can both see no receipt. The losing batch may hit the command UNIQUE constraint, including when its UPDATE affected zero rows and the account still has the winner's `version+1/last_command=key`. Catch this error, reread `(owner,key)`, compare the fingerprint, then return the original response. Never return the speculative response computed by the losing request.
3. **Compare fingerprint on every read path.** Check initial lookup, post-batch lookup, and exception recovery. Concurrent different payloads sharing a key must yield one winner and a conflict for the other, rather than returning an unrelated success.
4. **State-validation race before the batch.** Attempt B's first key lookup can miss; A commits an identical withdrawal; B reads A's new lower balance and fails the withdrawal as insufficient. Before returning a state-dependent transition error, reread the command and recover a matching committed receipt. An account/command read in one SQL snapshot also closes this particular lookup gap.
5. **Keep versions monotonic across reset and initialization.** `INSERT OR REPLACE` can wipe an account. Delete-and-recreate or resetting version to zero introduces an ABA race where an old in-flight version can match fresh state. Initialize with insert-if-absent; implement reset as a version-incrementing command, or include a generation ID in every CAS and command key.
6. **Return an indeterminate/retryable failure safely.** A timeout after the batch may mean it committed. Retry the same key, not a new key. If the receipt remains unavailable, do not claim definite failure or retry the economic operation under a fresh ID. After four ordinary CAS misses, return a bounded retryable conflict and have the client preserve its key.
7. **Caps must not break replay or strand outstanding actions.** Check existing receipts before rejecting at 2,000 events or 365 simulation days. Decide explicitly whether an event cap stops all new actions or permits resolving pending claims/withdrawals. An advance cap should not automatically block a claim. Bound appended event count after computing the operation; one command can append many events.

## Storage and consistency details

- Use `NOT NULL` on owner, key, fingerprint, state, response, and version. Bind every SQL value. Reject empty/oversized keys and unexpected payload keys. Include command type and schema version in a canonical fingerprint of validated business input; exclude changing server timestamps and generated results.
- Derive owner exclusively from trusted dispatch/auth. Verify it is nonempty before initialization or queries. The client must not choose owner through JSON, path, or arbitrary headers. Every query includes owner. Return private data with `Cache-Control: no-store`.
- Origin enforcement is an additional browser control, not authentication. Compare parsed exact allowed origins, never prefix/suffix strings. Reject `Origin: null` and unexpected/missing origins for the browser-only mutation surface. Keep preview development origins explicitly separate.
- The simplest consistency choice is the normal DB binding: Cloudflare states that queries without the Sessions API continue to use the primary. If using read replication, keep the complete mutation/recovery sequence in one `withSession('first-primary')` session. Avoid unconstrained independent sessions for receipt reads. [D1 read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/).
- Persist compact command receipts containing command ID, result, and committed version. Storing the whole growing account snapshot as every receipt creates quadratic storage growth. If full historical responses are intentionally retained, measure the maximum serialized size and aggregate storage cost.
- The event cap alone does not bound bytes: cap user-controlled string lengths and serialized request/state/receipt sizes. D1 currently limits a string, BLOB, or table row to 2,000,000 bytes. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).
- Never convert large entry weights to Number for settlement. Currency integers must be safe integers under an explicit maximum before conversion to BigInt; all additions must remain in range. Avoid parsing dollars with floating-point multiplication. Keep deterministic integer remainders if accumulating small yield across many steps so splitting time into smaller advances cannot erase or create yield.
- Historical replay responses may contain older state than the currently rendered state. Include committed version; the UI must not replace version 12 with a delayed/replayed version 9. Render a receipt separately or refetch current state.
- Do not delete idempotency rows during routine event compaction. If resetting makes old keys reusable, scope keys to a generation and make that lifecycle explicit.
- The four peers must be identified as simulated participants within each private scenario. Their results are not other users' deposits or live aggregate protocol activity.

## Practical integration tests

| Test | Required assertion |
|---|---|
| Two distinct deposits after a synchronized account read | Both eventually apply once; versions advance twice; two receipts |
| 20 concurrent identical deposit requests/key | Exactly one increment, one receipt, identical returned receipt |
| Same key with two amounts submitted concurrently | One winner; the other returns fingerprint conflict; no second increment |
| First key lookup paused; identical withdrawal commits; then read account | Recover successful receipt instead of insufficient-funds error |
| Two withdrawals of $80 racing against $100 | At most one succeeds; no negative balance or second receipt marked successful |
| Force the receipt INSERT to fail | The account update rolls back completely |
| Drop response immediately after commit | Retry same key returns original result without mutation |
| Force four successive CAS losses | Bounded retryable response; next retry preserves key and succeeds once |
| Older duplicate after several later commands | Original receipt returned; current account unchanged; UI version never rolls backward |
| Account reset while old command is paused | Old CAS cannot overwrite reset state |
| Simultaneous first requests for one owner | Initialization never erases either committed action |
| Same key for two owners | Independent receipts; neither can read or change the other account |
| Client injects owner, auth-like headers, or foreign origin | Rejected or ignored according to trusted routing; no wrong-owner state created |
| Event count 1,999 and command appends multiple events | Entire command rejected or handled under explicit cap policy; no partial application |
| Replay at event/day cap | Original receipt still succeeds |
| Day 365 with pending claim | Claim can complete under the chosen published cap policy |
| Advance 365 days once versus equivalent smaller steps | Same yield and entries except explicitly documented draw timing effects |
| Maximum request/state size and numeric boundaries | Reject oversized/unsafe values before expensive computation or SQL mutation |

I exercised the core SQL structure in in-memory SQLite: a stale different-key CAS produced neither a mutation nor receipt; a same-key race raised a recoverable unique conflict; a plain INSERT rolled back an attempted duplicate account update. A deliberate INSERT OR IGNORE variant reproduced the failure: account balance changed twice while the original command response remained unchanged. This validates those SQL counterexamples, not the deployed application.
