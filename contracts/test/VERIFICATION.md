# Steakhouse USDG V2 — source and pinned-fork verification

Run date: 2026-09-08. This work used public reads and a localhost-only fork. No public blockchain transaction was sent. No real private key was read or used. No privileged account was impersonated. No vault gate, role, adapter, or oracle was overridden.

## Exact deployed identity

- Network: Robinhood Chain, chain 4663.
- Vault: `0xBeEff033F34C046626B8D0A041844C5d1A5409dd`.
- USDG asset: `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, 6 decimals.
- Vault shares: 18 decimals.
- Pinned block: `58051564`.
- Pinned block hash: `0x1d402c216a49470d2c8dfe856e16846cc333b4da912fc2917f64fa87f9cd3cdc`.
- Runtime: 21,808 bytes.
- Runtime keccak256: `0x3492098028b641c5949beebf8c56898f1ed846f42b59978ed7c75249603c1f6e`.
- Runtime metadata trailer: `a164736f6c634300081c` (solc 0.8.28, no IPFS source hash).

The exact vault's public Blockscout contract page was inspected in Chrome. It reported source code verified with a **partial match**; contract `VaultV2`, source `src/VaultV2.sol`; compiler `v0.8.28+commit.7893614a`; EVM `cancun`; optimizer enabled with `100000` runs; verification time displayed `Jun 4, 2026 5:15:13`. Constructor arguments: original owner `0xfeed46c11F57B7126a773EeC6ae9cA7aE1C03C9a`, asset USDG above. Blockscout API requests returned 403 and Sourcify full/partial lookup returned 404. Thus this work does not claim an independently reproduced bytecode/source match or an exact deployment Git commit.

Explorer source page: https://robinhoodchain.blockscout.com/address/0xBeEff033F34C046626B8D0A041844C5d1A5409dd?tab=contract

Official upstream source inspected and saved at commit `a0ba9df0ea697a080c0de69c18b84738cfb3bef7` (2026-09-08T12:57:44Z): https://github.com/morpho-org/vault-v2/blob/a0ba9df0ea697a080c0de69c18b84738cfb3bef7/src/VaultV2.sol . This is the inspected upstream reference, **not a proven deployment commit**. Its default build profile uses via-IR, 100000 optimization runs and Cancun.

## Actual deployed-contract fork test

Anvil v1.8.1 (commit `982849d3140c01fd3b72905759581a132df7aa98`) forked the official RPC at the pinned block. Local chain ID was 31337, hardfork Cancun, bound only to 127.0.0.1:18546. Mining one fake local block was required because the Orbit source block omits Ethereum blob header fields and Anvil otherwise reports `Excess blob gas not set`.

A newly generated random test wallet received fake local ETH and 1000 fake local USDG via its ERC20 balance storage entry only. The script identified the standard mapping base slot 1 by restoring each candidate after a read; no other balances or contract configuration were changed. The private key existed only in process memory and was not saved.

All four deployed vault gate addresses were zero. `canReceiveShares`, `canSendShares`, `canReceiveAssets`, and `canSendAssets` each returned true for the ordinary test wallet. No gate bypass was used.

Successful local transactions:

1. Approve the exact vault for 1000 USDG.
2. Deposit 1000 USDG; received `993705424548148935700` raw vault shares.
3. Withdraw exactly 200 USDG.
4. Redeem all remaining shares.

End state: **1000.000001 fake USDG and zero vault shares**. All four receipt statuses were 1. The tiny change reflects local rounding/accrual timing and is not a return forecast. Gas values in the JSON are local execution measures, not live chain fee quotes. This does not validate automated stock acquisition or production keeper execution.

`fork-result.json` contains full public/local evidence and receipts; `fork-roundtrip.cjs` reproduces the test. It hardcodes localhost and rejects any chain ID other than31337 and any fork block other than58051564.

## Interaction rules

- Deposit: USDG `approve(vault, assets)`, then vault `deposit(assets, shareReceiver)`; funds come from `msg.sender`, shares go to the receiver.
- Deposit checks `canReceiveShares(shareReceiver)` and `canSendAssets(msg.sender)`. Allocation through the configured liquidity adapter can still revert.
- Withdraw: `withdraw(assets, assetReceiver, shareOwner)` burns sufficient shares; redeem: `redeem(shares, assetReceiver, shareOwner)` burns an exact share amount. A caller other than shareOwner needs sufficient vault-share allowance.
- Exit checks `canSendShares(shareOwner)` and `canReceiveAssets(assetReceiver)`. It uses idle USDG, then attempts liquidity-adapter deallocation for the difference; insufficient accessible liquidity can revert.
- **`maxDeposit`, `maxMint`, `maxWithdraw`, `maxRedeem` always return0 by design.** The test directly observed maxDeposit/maxWithdraw=0 and successful transactions. Do not interpret these values as a disabled vault.
- Previews compute share/asset conversions including fee effects; they do not prove gate eligibility or liquidity. Use an exact wallet-specific transaction simulation immediately before requesting a user signature.
- Deposit/redeem functions have no `minShares`/`minAssets` parameter. If user-configurable slippage bounds are required, enforce them in reviewed routing/bundling logic; don't imply a preview itself guarantees an execution amount.
- Current zero gates are a pinned-state observation, not a permanent permission guarantee. Curator changes, token restrictions, balances, approvals, liquidity, and network state must be checked again for actual interactions.

Primary docs: https://docs.morpho.org/developers/contracts/morpho-vaults-v2/ ; https://docs.robinhood.com/chain/connecting/
