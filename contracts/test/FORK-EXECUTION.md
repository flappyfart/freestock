# Local fork execution proof

Checked September 8, 2026, using Robinhood Chain mainnet block 58,051,564, hash `0x1d402c216a49470d2c8dfe856e16846cc333b4da912fc2917f64fa87f9cd3cdc`. Source chain 4663; isolated Anvil execution chain 31337 at localhost18547. This proves execution against pinned chain state with simulated funds, not a public transaction or production approval.

`fork-swap.cjs` and `fork-swap-result.json` contain the reproducible test and raw receipt/balance evidence. The script verifies localhost's fork identity before fake funding. A freshly generated wallet received 100 fake USDG by changing only its local balance mapping, plus local ETH for gas. It began with zero stock tokens and zero router allowance. No privileged account was impersonated, no gates were overridden, and no wallet private key was saved.

All three locally signed transactions succeeded:

1. The fresh wallet approved exactly 10 USDG for the official SwapRouter02.
2. It bought `0.044245277168941167` NVDA for exactly 10 USDG through the direct fee500 pool, matching the fresh quote. The swap included a 0.5% minimum-output tolerance and a five-minute deadline through `multicall(uint256,bytes[])`. The exact allowance was consumed.
3. It transferred `0.022122638584470583` NVDA to a second fresh address. Sender and recipient balances reconciled.

Local swap hash: `0x368d8482f3a0e80ab52322b1008b2bf11a269ace05e3b24bf5b32251ef21235c`. Local transfer hash: `0x325c666f10672780436097a98f09e7b69ba081cde806b04eb4cc84e02fa9ab59`. These are local fork receipts, not public explorer links.

## Direct USDG routes at fee500

Each admitted route had nonzero active liquidity and positive 1, 10, and 100 USDG quotes, with less than1% deterioration in output per USDG across those sample sizes. This is a bounded quote check, not a promise of fair price, future liquidity, or larger-order execution. Only NVDA was actually swapped and transferred in this test.

| Token | 10 USDG quote, token units | Pool |
|---|---:|---|
| NVDA | 0.044245277168941167 | `0xd4EB21209C4D6093f80B5b84f5C45cc093EA14a3` |
| AAPL | 0.031549583439291885 | `0xAae0d815EE56e4092a5E5C2911E676Fea50B2d6D` |
| MSFT | Unavailable: factory returns zero address | None at fee500 |
| TSLA | 0.027261557597094717 | `0xc4f0172D6ac8DD294Dd1137D047d5E1893760236` |
| GOOGL | 0.029524194640789393 | `0x34D0dC122CF9A8Eb296fC5e0D3A233625D7d19b7` |
| SPY | 0.013026130011925093 | `0xa7Bb1AC63BBaB0C44316E6c8C455213441689167` |

Fail an MSFT basket allocation explicitly when restricted to this route; do not silently change the basket weights. AAPL's issuer multiplier in the saved asset registry is1.000566080061092436, so token quantity is not identically the underlying-share equivalent. The table reports tokens.

## Production implications

No integrator API key is required for this direct onchain route. Build a fresh exact-size QuoterV2 call, minimum output, deadline, finite approval, and actual-sender simulation immediately before the user's wallet signs. Reject missing/exhausted pools and empty or implausible quotes; an earlier fee100 NVDA pool returned the same tiny output for multiple input sizes and must not be selected just because a nonzero quote exists. Actual user balances, gas, token restrictions, liquidity, and state changes can still prevent execution. A successful fresh-wallet transfer at this block does not establish legal eligibility or future token behavior. Never label Stock Tokens as direct ownership of the underlying shares.

Primary identity and contract sources: [Robinhood asset registry](https://api.robinhood.com/rhj/assets), [Robinhood Stock Token API documentation](https://docs.robinhood.com/chain/stock-token-apis/), [Uniswap SDK deployment constants](https://github.com/Uniswap/sdks/blob/main/sdks/sdk-core/src/addresses.ts), [Uniswap deployments](https://developers.uniswap.org/deployments), [Robinhood Stock Tokens](https://robinhood.com/rhj/stocktokens/).
