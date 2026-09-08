# FreestockYieldAccount pinned-fork validation

Source tested: `/Users/freestock/Documents/Codex/2026-09-08/e/outputs/freestock/contracts/src/FreestockYieldAccount.sol`.

Source keccak256: `0xb43bec67f7266c27c1da0fc40b35775496f2ee5c0a8f31218500bd1ea7352656`.

Compiled with cached Solidity `0.8.30+commit.73712a01.Emscripten.clang`, optimizer enabled with 200 runs, **viaIR true**, EVM Cancun. Without viaIR, compilation fails with stack-too-deep at the basket swap call; failure output is retained in `account-without-via-ir-error.json`. Successful standard JSON input/output, ABI, creation bytecode and combined artifact are included in this directory. Creation code is 9325 bytes; runtime template is 7981 bytes.

## Result

**39 checks passed**, using the exact existing Morpho vault and actual deployed Uniswap Router02/QuoterV2/NVDA contracts on a local-only fork of Robinhood Chain block58051564. No public writes, real funds, real private keys, privileged impersonation, or gate changes were used.

New account deployed locally: `0x319a9aA11350218fe8939c3e70E9377b383880bd`.

The new account was an ordinary unprivileged contract. Its fresh test owner received only100 fakeUSDG and fake gas funds. Constructor used canonical USDG, Steakhouse vault, fixed Router02, NVDA allowlist and100e6 cap. All four actual vault permissions allowed this contract.

Successful checks included deposit100USDG, deposit cap enforcement, nonzero and sufficient minimum shares, owner-only deposit/withdraw/compound/harvest, zero-yield harvest rejection, partial withdrawal25USDG, maximum-share enforcement, full withdrawal with minimum-asset enforcement and complete share/principal cleanup. Both vault and router allowances returned to zero.

First full exit returned99.999999USDG, a one-base-unit rounding difference. That balance was redeposited. Local time was advanced30days and a local block mined, causing **the existing real adapters' accounting** to recognize0.336274USDG of yield. This is time-accelerated fork execution, not observed thirty-day mainnet performance or a yield forecast.

Attempting to spend the calculated yield plus1USDG was rejected with `YIELD_ONLY`. A real local transaction using an impossible minimumNVDA output reverted, with the account's vault shares, principal, idleUSDG, ownerUSDG/NVDA, and totalSpent exactly unchanged. The valid harvest spent0.336272USDG (yield less two base units) through the actual500-fee NVDA pool and delivered **0.001487841040218078NVDA** to the owner. Principal remained99.999999USDG; remaining account assets covered it. Full withdrawal then returned **100.000001USDG**, retained the purchased NVDA, and left zero principal, shares and idle assets.

## Scope and semantics

- This validates the tested owner-signed contract path in a controlled fork, not a deployed public freestock account, production keeper, audit, or legal eligibility conclusion.
- The account does not have a keeper; each harvest requires its owner. It must not be presented as unattended automation.
- `availableYield()` measures NAV above recordedprincipal. Donations of USDG or vaultshares also contribute to this surplus; it is not a provenance proof that every spendable unit came from borrower interest.
- Vaultshares already compound. Calling `compound` raises the principal benchmark so selected surplus is retained; it is not a second yield source. The actual state-changing compound path was not included in this39-check flow, although owner authorization was checked.
- depositCap limits principal plus a newdeposit. Retained/compounded gains can make totalaccountassets or principal exceed100USDG; do not label it a hard balancecap.
- One-microUSDG rounding was observed. The tested two-base-unit buffers avoid treating an exact preview as a guaranteed execution amount.
- No transfer, gate, allowance or principal-protection controls were disabled to achieve the tests.

## Reproduction

Use the running localhost fork18546, or start Anvil v1.8.1 at pinnedblock58051564 with Cancun, localchain31337, localhost only and no storagecache; mine one localblock before reads to initialize Ethereum blob-header defaults. `test-account.cjs` uses `fake-funding.cjs`, which rejects any non31337 chain or different forkblock and caps newly minted local test funds at100USDG.

`node compile-account.cjs` regenerates the exact ABI/bytecode from the Site's contract source. `node test-account.cjs` runs the flow. Private test keys are generated in memory and never saved. All mutation endpoints are localhost-only; upstream requests only fetch public forkstate.

Primary evidence: `account-test-result.json`; canonical vault bytecode and compiler identity: `VERIFICATION.md` and `vault-runtime.hex`.
