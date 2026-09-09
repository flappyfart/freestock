# Freestock real-chain integration — 8 September 2026

## What works now

The homepage live account area and `/live` connect an injected wallet using EIP-6963. The homepage keeps a separately labeled “Try it yourself” practice box. Participant availability is checked before new actions are offered. Read-only views show real chain balances and Uniswap V3 quotes. The separately labeled private pilot supports account creation, exact USDG approval, deposits, reserving gains as principal, single-stock or weighted-basket purchases and full withdrawal. Every financial action requires explicit review and an EIP-1193 wallet confirmation; no server signer exists.

Preparation verifies chain 4663, exact deployment calldata, canonical deployment receipt/block, CREATE address, runtime bytes, constructor ownership and fixed dependencies. Deposits apply a 0.1% share minimum; stock legs have a 1% minimum-output allowance and a 120-second onchain deadline. A fresh actual-sender simulation and gas estimate precede each wallet prompt. Plans expire after 45 seconds and bind the nonce. Client validation repeats route, amount, recipient, expiry, sender and network checks. Receipts and token purchase events are reconciled against the verified account.

Only the exact signed-in participant configured by `FREESTOCK_PILOT_USER_ID`, with country `NO` and non-US-person declaration `no`, receives entry/trading preparation. This is product authorization based on the participant's declarations, not issuer identity verification. Withdrawal preparation remains available for an existing verified account even if new pilot actions are disabled. Public availability self-checks do not grant access. All routes require Sites identity and return private, uncached responses.

Pending wallet requests use a device-only owner/chain journal with unique request IDs, nonces and transaction/account references. Web Locks serialize updates across tabs. Unknown submission outcomes stay locked against automatic retries; late replies cannot replace successor requests. Recovery checks original sender/nonce and canonical receipts, including wallet cancellation or another transaction consuming that nonce. Journal state is not a balance ledger. No background trading runs.

Verified deployment hashes are saved per chain and owner in browser storage. Pending journal and URL references take precedence, and every restored account is verified against the chain. Storage failures leave manual recovery available. Account balances refresh every 30 seconds while the tab is visible; reviews, active requests and unreconciled transactions pause automatic reads. No balances are persisted in this reference store.

`ROBINHOOD_RPC_URL` optionally selects a dedicated HTTPS RPC. Otherwise reads use the official public RPC with its availability/rate limits. The server RPC wrapper allows only reads and simulations. The browser wallet alone submits transactions after user approval.

## Tested execution path

Chain 4663. Canonical 6-decimal USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`; Steakhouse USDG vault `0xBeEff033F34C046626B8D0A041844C5d1A5409dd`; Router02 `0xcaf681a66d020601342297493863e78c959e5cb2`; QuoterV2 `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7`; factory `0x1f7d7550b1b028f7571e69a784071f0205fd2efa`.

The account constructor allows the five tested stocks. NVIDIA is: `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC`. The selected USDG/NVDA fee-500 pool is `0xd4eb21209c4d6093f80b5b84f5c45cc093ea14a3`. AAPL, TSLA, GOOGL and SPY also passed swap/transfer tests. MSFT has no direct fee-500 pool and rejects. The quote service checks half-size versus full-size output to reject exhausted or strongly nonlinear routes; it includes a 1% minimum-output allowance and 60-second validity. These are not execution promises or oracle valuations.

The account has one immutable owner, set to the actual constructor caller. New deposits must leave the principal baseline at or below 100 USDG. Compounded gains can raise that baseline above 100; this is a deposit limit, not a total-assets cap. Only the owner can deposit, withdraw, compound or harvest. There is no operator, arbitrary external call, upgrade or background permission.

Available gains equal account asset value above the recorded principal baseline. Losses must recover before harvest. Direct donations also count as gains; this is not a provenance claim about borrower interest. Holding vault shares already accumulates the vault return. `compound` moves gains into the principal baseline rather than creating another source of yield. Purchases approve exact amounts, enforce stock minimums/deadline, check actual token receipts and reset allowances. Basket legs revert together. Rounding and losses can reduce capital; no principal guarantee is implied.

## Evidence and limits

`contracts/test/` records a local fork of block **58,051,564**, hash `0x1d402c216a49470d2c8dfe856e16846cc333b4da912fc2917f64fa87f9cd3cdc`. Fresh unprivileged wallets received fake balances only on the local chain. No gate overrides, privileged impersonation or public transactions were used.

- Direct vault deposit, partial withdrawal and complete redemption passed.
- Direct 10 fake USDG purchase produced 0.044245277168941167 NVIDIA tokens; onward token transfer passed and the router allowance was exhausted.
- The new account passed **39 assertions**, including ownership, cap, slippage, gains-only budget, actual conversion, full exit, allowance cleanup and atomic rollback on an impossible stock minimum.
- The account test advanced **local time by 30 days**. Genuine adapter accounting at that pinned state produced a surplus, but neither that amount nor time acceleration represents a real deposit, live earnings or a return forecast. A two-micro-USDG buffer was retained for rounding.
- The vault explorer reports a partial source match. Its exact deployed Git commit has not been proven. Local success does not prove future liquidity or eligibility.

Solidity artifact: 0.8.30, optimizer 200, viaIR true, Cancun. `contracts/artifacts/account-standard-input.json` permits exact recompilation. The source/artifact hash is tested automatically. No public transaction was submitted by the builder. Mainnet deployment occurs only when the participant creates an account in their own wallet.

## Norway pilot and boundaries

The participant declared residence and physical location in Norway and that they are not a US person or acting for one. Norway is explicitly included in the Final Terms for all five selected tokens. This is a country-level finding, not approval of freestock or identity verification. Investor representations and applicable issuer restrictions still apply.

The prospectus distinguishes direct secondary blockchain purchases from purchases through an Authorised Participant, while also containing broader KYC/AML wording. This work does not assert that self-attestation alone is a completed verification. No issuer API key is required for the verified direct AMM route, and no mandatory AMM provider-preapproval workflow was established.

The user must connect a funded EOA wallet, review issuer terms, create their account and approve each financial action. No real deposit or public stock purchase has been executed in this build session. Check current fees and immediately withdrawable liquidity; quoted asset value alone is not spendable cash. Automatic conversion, keeper permissions, staking adapters and leveraged LP execution remain unimplemented. This is a limited private pilot, not an unrestricted public product.

## Verification performed on this version

- 69 unit tests passed, including six account-reference storage/recovery tests, including amount/address validation, exact constructor dependencies, bytecode/source identity and rejection of malformed runtime responses.
- Lint, TypeScript and the production build passed.
- 18 local read-only live API checks passed against current mainnet reads: authentication, input validation, balances, NVIDIA quote, MSFT route rejection, unfunded deposit preview and simulated account creation.
- Existing practice API regression: 12 groups / 46 requests passed in an isolated local database. No hosted account was changed.

- The full five-stock API and wallet pipeline passed **93 assertions** on a separate fresh local fork pinned to block **58,065,058**, hash `0x360c98ead6fcff5b014f857cd57939035ead668de49e66735ee54453d060af2a`. It used a fresh fake-funded wallet, deposited 10, donated 0.1 to create gains, reserved 0.02, purchased five 0.01 stock legs and withdrew the remaining 10.05 USDG. The donation was **not lending income**; genuine adapter-interest conversion was proved separately by the earlier 39-check test. No public transactions, privileged impersonation or gate overrides were used.
- UI switches follow the supplied Uiverse.io design by reglobby with accessible native controls, clear state text, focus indicators and reduced-motion support.
- 12 additional local receipt-recovery assertions passed: a confirmed unrelated transaction at the recorded nonce reports replacement, a zero-value self-transaction reports cancellation, and a mismatched nonce is rejected. Both signed transactions stayed on the fake-funded local fork.
- 10 further recovery assertions passed for an ordinary USDG transfer: a matching recorded nonce reports replacement and retains the verified account snapshot; the same transfer without a recovery nonce is rejected. One micro-USDG moved only on the fake-funded local fork.

## Primary sources

- [Robinhood Chain connection details](https://docs.robinhood.com/chain/connecting/)
- [Morpho Vault V2 contracts](https://docs.morpho.org/developers/contracts/morpho-vaults-v2/)
- [Uniswap deployments](https://developers.uniswap.org/deployments)
- [Issuer token registry](https://api.robinhood.com/rhj/assets)
- [Building with Stock Tokens](https://docs.robinhood.com/chain/building-with-stock-tokens/)
- [NVIDIA Final Terms, Norway on page 8](https://cdn.robinhood.com/assets/robinhood/legal/rhj_final_terms_for_tokenised_debt_securities_linked_to_nvidia.pdf#page=8)
- [Base Prospectus](https://cdn.robinhood.com/assets/robinhood/legal/rhj_base_prospectus.pdf): pages 72, 119, 131 and 150–151 for purchaser, secondary-market and eligibility provisions.

Additional Final Terms with Norway included: [AAPL](https://cdn.robinhood.com/assets/robinhood/legal/rhj_final_terms_for_tokenised_debt_securities_linked_to_apple.pdf#page=8), [TSLA](https://cdn.robinhood.com/assets/robinhood/legal/rhj_final_terms_for_tokenised_debt_securities_linked_to_tesla.pdf#page=8), [GOOGL](https://cdn.robinhood.com/assets/robinhood/legal/rhj_final_terms_for_tokenised_debt_securities_linked_to_alphabet_class_a.pdf#page=8), [SPY](https://cdn.robinhood.com/assets/robinhood/legal/rhj_final_terms_for_tokenised_debt_securities_linked_to_spdr_s_p_500_etf_trust.pdf#page=9).

## Homepage launch readiness check

`contracts/test/current-mainnet-readiness.json` records the fresh check. On 2026-09-09 at 00:40:27 UTC, 65 read-only RPC checks completed without error at block 58,125,772. Vault runtime matched the pinned dependency, the 100 USDG deposit preview remained positive, and all five selected fee-500 stock pools returned positive 1 and 100 USDG quotes. The issuer registry still listed all five tokens as active. This check submitted no public transactions and is not proof of future liquidity. The Apple multiplier was 1.000566080061092436, so quantities are labeled tokens rather than underlying shares.

The deployed environment still uses the official public RPC fallback; dedicated production capacity is not configured. General registration, unattended conversion, staking and leveraged LP execution remain outside this private wallet pilot.
