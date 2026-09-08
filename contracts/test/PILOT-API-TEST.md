# Local wallet API integration result

Passed 93 assertions through the production Worker on `http://127.0.0.1:3013`, with chain access and all signatures restricted to Anvil at `http://127.0.0.1:18546`, chain ID 4663.

Source fork block: **58065058**. Source block hash: `0x360c98ead6fcff5b014f857cd57939035ead668de49e66735ee54453d060af2a`.

The runner verified the localhost URLs, Anvil fork configuration, chain ID, and pinned header before loading the scratch fixture key. It repeated the fork checks before each signed transaction. The fixture key remained in a file with permissions 0600. No key appears in this report or the JSON evidence. No public transactions, privileged impersonation, gate changes, or new funding storage changes occurred during this test.

## Actual API and wallet path

- Prepared and signed the canonical account deployment through the actual client `validatePrepared` and `submitPrepared` functions.
- Verified the successful deployment receipt, sender, runtime, owner, canonical asset/vault/router, cap, and all five stock allowances.
- Approved exactly 10 USDG and deposited 10 USDG. The owner approval was consumed and the account's vault allowance returned to zero.
- Rejected an unrelated caller, a non-enabled app user, a mismatched receipt owner, a principal-limit violation, an amount above 100 USDG, and attempted spending or reserving principal as gains.
- Rejected an approval transaction used as a deployment reference, and a genuinely deployed same-owner account with a noncanonical 99 USDG cap.
- Transferred an ordinary 0.1 USDG donation from the fake-funded owner into the account, then reserved 0.02 USDG as principal.
- Prepared and executed an atomic five-stock basket spending 0.05 USDG total. All five `StockPurchased` receipt events matched the actual owner token balances, at 0.01 USDG per stock.
- Withdrew the entire remaining 10.05 USDG. Account principal, shares, idle USDG, and available gains all ended at zero. Router and vault allowances were zero.

This test's purchasable gains came from the explicitly recorded **donation**, not measured lending interest. The separate earlier `account-test-result.json` contains the genuine adapter-interest test using local 30-day acceleration at its original fork pin. Neither result is a public trade or investment-performance claim.

## Reconciliation

Initial owner USDG: **100**. Stock purchases: **0.05 USDG**. Final owner USDG: **99.95**.

| Stock | Final owner tokens |
|---|---:|
| NVDA | 0.000044230137748088 |
| AAPL | 0.000031548165004229 |
| TSLA | 0.000027267464846610 |
| GOOGL | 0.000029491650341088 |
| SPY | 0.000013026169666668 |

Local account: `0x6c595A6Aa6a1acfDbE1c9F0c3aB4CA49a601CF39`.

Local creation transaction: `0x49c334fc59912135ea41a727a869db195372463ccd4c0046002c618659ed12b3`.

Full API requests, responses, unsigned plans, local transaction hashes, parsed receipts, assertions, and reconciliation are preserved in `pilot-api-result.json`. The repeatable scratch runner is `test-pilot-api.cjs`. A normal run requires the untouched fixture; `--resume` retains checkpointed transaction hashes to avoid repeating already submitted actions.
