# Freestock integration readiness

Verified 2026-09-08. This report treats the pasted conversation as background claims and separates them from current documentation and read-only network evidence. No transaction, deposit, token purchase, bridge, or deployment was submitted.

## Decision

The proposed architecture is implementable enough to build and test. Mainnet deposit activation is still premature: a fresh-contract vault round trip and an actual stock purchase/award path remain untested. The live checks improve materially on the pasted conversation: vault gates were readable, and both CCIP routers confirmed destination support.

## Verified integration facts

### Robinhood Chain and USDG

Mainnet chain ID is **4663**, with ETH for gas. The official public RPC is rate-limited and explicitly unsuitable as the sole production endpoint. Use a dedicated provider and an archive-capable endpoint for reproducible forks. [Robinhood network configuration](https://docs.robinhood.com/chain/connecting/)

Canonical USDG is **0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168**. The live contract returned **6 decimals**. Do not identify assets by ticker alone. [Robinhood token contracts](https://docs.robinhood.com/chain/contracts/)

### Steakhouse USDG vault: current gates now verified

Morpho's app identifies **0xBeEff033F34C046626B8D0A041844C5d1A5409dd** as the **V2 Steakhouse USDG vault** on Robinhood Chain. Morpho's announcement confirms the Earn architecture combines USDG, Steakhouse-curated vault infrastructure, and Robinhood Chain; it does not establish permission for an independent wrapper. [Official vault listing](https://app.morpho.org/robinhood-chain/vault/0xBeEff033F34C046626B8D0A041844C5d1A5409dd/steakhouse-usdg), [Morpho announcement](https://morpho.org/blog/robinhood-chooses-morpho-to-power-new-earn-product)

At block **57,944,950**, hash **0x182cff805d9d801d038342ea3057ca929c4b20008d0c213fcce684f4c2574609**, timestamp **2026-09-08 19:36:25 UTC**, direct `eth_call` reads returned:

| Setting | Address | Setter abdicated | Setter timelock |
|---|---|---|---|
| sendAssetsGate | zero | false | 604,800 seconds |
| receiveSharesGate | zero | true | 604,800 seconds |
| sendSharesGate | zero | true | 604,800 seconds |
| receiveAssetsGate | zero | true | 604,800 seconds |

The vault's `asset()` matches canonical USDG. Vault shares report 18 decimals. Owner: **0xCa50D23F1c18C1Dfaff5d3cae3aa4B9dC5C8db73**. Curator: **0x9023fbd6a08c666491a2d1648737e400cf42d2fb**. Liquidity adapter: **0x44abc1d6ccff2696d98890b92e2157af242179c2**.

Interpretation: all four gates currently permit access as far as these gates are concerned. Three gate setters have been relinquished; the curator still retains the ability to introduce a deposit gate, subject to the current seven-day timelock. This does **not** prove adequate withdrawal liquidity, general USDG transfer permissions, or a successful independent-contract round trip. Morpho's documented gate semantics support this interpretation. [Morpho gates](https://docs.morpho.org/curate/concepts/gates/)

`maxDeposit`, `maxMint`, `maxWithdraw`, and `maxRedeem` deliberately return zero in V2. Do not classify the vault as inaccessible solely from these methods. [Morpho V2 contract reference](https://docs.morpho.org/developers/contracts/morpho-vaults-v2/)

Raw read evidence: `work/live-integration-reads.json`. Runtime bytecode: **21,808 bytes**, keccak256 **0x3492098028b641c5949beebf8c56898f1ed846f42b59978ed7c75249603c1f6e**. This fingerprint has not yet been matched to a reviewed source build.

### CCIP: both runtime support checks passed

| Network | Router | CCIP selector |
|---|---|---|
| Arbitrum One | 0x141fa059441E0ca23ce184B6A78bafD2A517DdE8 | 4949039107694359620 |
| Robinhood Chain | 0x06fC836cf9839B1cd891C440A0a45242DA6Ae1c9 | 6180753054346818345 |

These addresses/selectors agree with the [Arbitrum directory](https://docs.chain.link/ccip/directory/mainnet/chain/ethereum-mainnet-arbitrum-1) and [Robinhood directory](https://docs.chain.link/ccip/directory/mainnet/chain/robinhood-mainnet). The latter visibly lists an outbound Arbitrum lane, version 1.6.0.

The Robinhood router returned `true` for `isChainSupported(4949039107694359620)` at block 57,944,950. The Arbitrum router returned `true` for `isChainSupported(6180753054346818345)` at block **503,124,523**. This verifies configured runtime destination support in both directions. No fee quote or application-level message delivery was executed. These selectors are not EVM chain IDs.

### VRF

Chainlink documents **VRF v2.5 on Arbitrum One**, coordinator **0x3C0Ca683b403E37668AE3DC4FB62F4B29B6f7a3e**. Robinhood is absent from the current supported VRF network list; native Robinhood VRF support is not established. [Supported networks](https://docs.chain.link/vrf/v2-5/supported-networks)

Store the random word and its request/round binding in the VRF callback. Relay over CCIP and execute stock settlement in separately retryable steps. Callback reverts are not retried by VRF. Freeze eligible draw inputs before requesting randomness, reject rerolls, match fulfillment by request ID, and tolerate out-of-order delivery. [VRF security](https://docs.chain.link/vrf/v2-5/security)

### Stock settlement

Robinhood documents stock tokens as ERC-20s with 18 decimals and secondary-market integration via RFQ aggregators, AMMs, and Rialto. Direct issuer mint/burn requires authorized-participant KYB and is not an assumed Freestock capability. A usable route, quote, taker identity, allowance target, settlement contract, and actual liquidity still need verification. [Building with Stock Tokens](https://docs.robinhood.com/chain/building-with-stock-tokens/)

These instruments are tokenized debt securities that provide economic exposure. They do not grant ownership rights in the underlying stock. Describe awards as stock tokens. Dividends/splits change the shares-per-token multiplier while raw token balances remain static. [Stock Token overview](https://docs.robinhood.com/chain/stock-tokens/)

The public [assets API](https://api.robinhood.com/rhj/assets) returned active deployments on chain 4663:

| Symbol | Contract |
|---|---|
| AAPL | 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9 |
| NVDA | 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC |
| MSFT | 0xe93237C50D904957Cf27E7B1133b510C669c2e74 |
| TSLA | 0x322F0929c4625eD5bAd873c95208D54E1c003b2d |
| GOOGL | 0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3 |
| SPY | 0x117cc2133c37B721F49dE2A7a74833232B3B4C0C |

Observed AAPL multiplier: **1.000566080061092436**; the other listed entries were 1.0. Raw API snapshot: `work/robinhood-stock-assets.json`. The live response uses nested `tradingCapabilities.market/extended/overnight.{whole,fractional}`, differing from the flattened documentation example. Validate live payloads and treat absent fields as unknown.

Robinhood's REST prices are raw underlying bid/ask; onchain Chainlink values already incorporate the multiplier. Applying it twice would misprice awards. Respect freshness, trading halts, and cache intervals. The public endpoints provide data, not execution. [Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis/)

## Product and accounting corrections

Do not promise protected principal, guaranteed 1:1 withdrawal, instant liquidity, a fixed 7% APY, or inherited Robinhood insurance. Robinhood's own disclosures make liquidity conditional, rates variable, principal losable, and insurance specific to Robinhood. Freestock should budget prizes only from realized, unencumbered yield after costs and already-committed prizes. [Robinhood Earn disclosure](https://robinhood.com/us/en/support/articles/robinhood-earn/)

The official Morpho campaign listing labels the 7% Earn campaign **Robinhood Users Only**. Freestock has not established eligibility for those rewards, so exclude them from baseline economics. [Morpho opportunities](https://campaigns.morpho.org/?rewardType=ecosystem)

## Acceptance tests before accepting real deposits

These are proposed tests, not tests completed during this research pass.

1. **Vault identity and contract access:** Pin a current mainnet fork block; verify chain ID, vault bytecode/source match, asset and decimals, every gate/abdication/timelock, adapter configuration, and pending governance changes. Deploy a fresh unprivileged adapter and run `approve → deposit → receive shares → redeem → receive USDG`. Preserve traces and balance deltas. Do not impersonate an authorized depositor, alter allowlists, or disable gates. Seed only test funds on the fork.
2. **Liquidity and loss accounting:** Test fully liquid, partially liquid, and illiquid withdrawals; vault share losses; rounding/dust; and changing deposit permissions. A failed withdrawal cannot burn the user's claim or falsely display settled funds. Prize extraction cannot consume principal liabilities or reserved withdrawal amounts.
3. **Randomness integrity:** Snapshot eligibility before request; match request ID to draw ID; reject late eligibility changes, duplicate requests, coordinator spoofing, and rerolls. Out-of-order callbacks remain correct. Callback only persists the result. A relay outage does not lose or replace that result.
4. **CCIP delivery:** Recheck both routers, obtain a fee quote for the actual payload, and deliver between the actual application contracts. Reject wrong router/source selector/source sender, duplicate message IDs, altered draw bindings, and replayed messages. Retry failed delivery without selecting another winner. Persist message IDs and finality status.
5. **Stock acquisition and award:** Resolve canonical token address and metadata, obtain an executable quote for the adapter/taker, and settle on a fork or authorized test environment. Verify bought-token balance delta, maximum spend, minimum received, allowed spender/target, deadline, and winner transfer. Test expired quote, no liquidity, halt, stale price, multiplier changes, and transfer failure. Failed purchase remains pending and cannot be shown as a completed award.
6. **Operations:** Demonstrate RPC failover, restart-safe indexing, reorg reconciliation, idempotent jobs, authenticated administration, spend limits, pause/resume behavior, monitoring, and recovery from every intermediate draw state. Funded production activation should depend on recorded completion of these tests and the deployment review.
