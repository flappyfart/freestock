# Contract reference

[README](../README.md) · [Backend](BACKEND.md) · [Developer guide](DEVELOPMENT.md)

Freestock's private pilot uses one owner-controlled `FreestockYieldAccount` per participant. **There is no shared Freestock account, deployment factory or Freestock project-token address configured.** The participant deploys their account from their wallet; the dashboard verifies it before using it.

## Network and configured dependencies

Robinhood Chain mainnet, chain ID **4663**. Native gas token: **ETH**. USDG accounting uses **6 decimals**. These addresses document this repository's configuration; current liquidity and transaction support must still pass fresh checks.

| Dependency | Address / explorer |
| --- | --- |
| USDG | [`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`](https://robinhoodchain.blockscout.com/address/0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168) |
| Steakhouse USDG vault | [`0xBeEff033F34C046626B8D0A041844C5d1A5409dd`](https://robinhoodchain.blockscout.com/address/0xBeEff033F34C046626B8D0A041844C5d1A5409dd) |
| SwapRouter02 | [`0xcaf681a66d020601342297493863e78c959e5cb2`](https://robinhoodchain.blockscout.com/address/0xcaf681a66d020601342297493863e78c959e5cb2) |
| Uniswap V3 factory | [`0x1f7d7550b1b028f7571e69a784071f0205fd2efa`](https://robinhoodchain.blockscout.com/address/0x1f7d7550b1b028f7571e69a784071f0205fd2efa) |
| QuoterV2 | [`0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7`](https://robinhoodchain.blockscout.com/address/0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7) |

## Enabled stock tokens

The funded pilot supports these five configured tokens, each with 18 decimals. The addresses identify the onchain token contracts, not ordinary brokerage shares.

| Symbol | Name | Address / explorer |
| --- | --- | --- |
| NVDA | NVIDIA | [`0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC`](https://robinhoodchain.blockscout.com/address/0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC) |
| AAPL | Apple | [`0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9`](https://robinhoodchain.blockscout.com/address/0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9) |
| TSLA | Tesla | [`0x322F0929c4625eD5bAd873c95208D54E1c003b2d`](https://robinhoodchain.blockscout.com/address/0x322F0929c4625eD5bAd873c95208D54E1c003b2d) |
| GOOGL | Alphabet | [`0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3`](https://robinhoodchain.blockscout.com/address/0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3) |
| SPY | SPDR S&P 500 ETF | [`0x117cc2133c37B721F49dE2A7a74833232B3B4C0C`](https://robinhoodchain.blockscout.com/address/0x117cc2133c37B721F49dE2A7a74833232B3B4C0C) |

The executable configuration lives in [`config.ts`](../lib/live/config.ts), [`basket.ts`](../lib/live/basket.ts) and [`quote.ts`](../lib/live/quote.ts). Microsoft references and Sandisk artwork do not add those assets to the enabled pilot.

## Ownership and permissions

[Read the full Solidity source](../contracts/src/FreestockYieldAccount.sol).

`owner` is fixed to the deploying wallet (`msg.sender`). `asset`, `vault`, `router` and `depositCap` are immutable constructor inputs. `stockAllowed` is a constructor-populated mapping with no setter. Each financial entry point is owner-only and guarded against reentrancy.

This account has no keeper permission, operator spending role, upgrade entry point, owner-transfer method or arbitrary external-call interface. Those statements describe the Freestock account, not the governance or permissions of external vaults, routers or token issuers. The current backend only prepares transactions; the owner must approve each one.

| Function | Behavior |
| --- | --- |
| `deposit(amount, minShares)` | Transfers exact USDG from owner, checks the principal cap and deposits into the fixed vault |
| `withdraw(amount, maxShares)` | Partial USDG withdrawal to owner; decreases the principal baseline, floored at zero |
| `withdrawAll(minAssets)` | Redeems the position and transfers available USDG to owner; clears the principal baseline |
| `compound(amount)` | Adds available surplus to the principal baseline and deposits idle USDG |
| `harvest(stocks, fees, amounts, minimums, compoundAmount, deadline)` | Buys allowed stock tokens for owner and optionally reserves some gains |
| `totalAssets()` | Redeemable vault-share value plus idle USDG |
| `availableYield()` | Positive difference between total assets and the principal baseline |

The primary interface exposes full withdrawal. Partial withdrawal exists at the contract level; its presence here does not imply a corresponding dashboard control.

## Accounting and the cap

```text
value = vault.previewRedeem(account vault shares) + account USDG balance
surplus = max(value − principal, 0)
```

The constructor accepts a deposit cap greater than zero and no greater than 100 USDG. A new deposit checks `principal + amount <= depositCap`. This caps new entry against the current principal baseline; compounding can increase that baseline above the cap. Withdrawals reduce the baseline and can restore deposit capacity. It is not a lifetime deposit cap or a maximum portfolio value.

Losses must recover above the baseline before surplus is spendable. Explicit compounding reserves gains within that baseline; lending returns already accrue while vault shares are held. Donated USDG or vault shares increase total assets and count as available gains. The contract does not prove the provenance of interest or protect against future losses.

The current client reserves two micro-USDG for rounding on purchases. This is a preparation policy, not a guarantee that every theoretically positive gain can be economically converted.

## Harvest constraints

A harvest requires matching arrays with between one and six basket entries, no duplicate stocks, allowed stock addresses and supported fee tiers (`100`, `500`, `3000`, `10000`). Its deadline must be current and no more than 300 seconds ahead. The proposed stock budget plus reservation amount must fit the available surplus.

The account withdraws the budget from the vault as needed, checks principal coverage, grants the fixed router an exact spending allowance, checks actual token receipts at the owner's wallet, resets approvals and checks principal coverage again. Remaining idle USDG is deposited back into the vault. All basket legs execute in one transaction; a failed leg reverts the entire harvest.

Current application policy uses fee tier `500` (0.05%), a 1% quote-to-minimum-output tolerance and a 120-second deadline. The contract's wider allowed set is not a claim that all such routes have liquidity. Fresh account verification, quotes, simulation and owner review are still required. Network fees are paid separately in ETH.

## Events

| Event | Meaning |
| --- | --- |
| `Deposited` | USDG added and vault shares received |
| `Withdrawn` | Partial USDG withdrawal and resulting baseline |
| `Compounded` | Gains reserved into the principal baseline |
| `StockPurchased` | Stock address, USDG spent and actual token receipt |
| `Closed` | Full exit of the account's USDG position |

[Portfolio Activity](BACKEND.md#portfolio-activity-and-recovery) reads these events alongside canonical receipts. They do not cover unsolicited transfers or every asset in the owner's wallet.

## Build artifacts and verification

- [Compiler standard input](../contracts/artifacts/account-standard-input.json)
- [ABI, creation/runtime bytecode and immutable offsets](../contracts/artifacts/FreestockYieldAccount.artifact.json)
- [Account preparation and verification code](../lib/live/account-plan.ts)
- [Live preparation and receipt validation](../lib/live/pilot.ts)

The saved build uses Solidity **0.8.30**, optimizer enabled with **200 runs**, **viaIR** and **Cancun**. The source pragma is `^0.8.28`; compiling with a different compatible compiler is not evidence of byte-for-byte equivalence to the committed artifact. Preserve the exact input and settings when reproducing it. The source hash is included as artifact metadata. Account verification checks exact creation calldata, the canonical deployment receipt, runtime bytecode with immutable slots handled separately, and getters for owner, asset, vault, router and cap.

## Validation evidence and limits

The repository retains dated [account test evidence](../contracts/test/ACCOUNT-TEST.md), [fork execution notes](../contracts/test/FORK-EXECUTION.md) and [pilot API checks](../contracts/test/PILOT-API-TEST.md). A 39-assertion local-fork exercise used fake funds and accelerated time. A separate 93-assertion exercise used constructed surplus, including donations. These are implementation checks, not funded production results or return forecasts.

Some historical reports refer to scratch runners outside the repository; those reports are evidence records, not reproducible setup commands. Use the committed application tests and the [developer guide](DEVELOPMENT.md) for the current checkout. The next operational milestone is an explicitly owner-approved funded lifecycle with reconciled receipts.
