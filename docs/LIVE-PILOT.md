# Freestock real-chain integration — 8 September 2026

## What works now

The private `/live` page connects an injected Ethereum wallet using EIP-6963, reads actual Robinhood Chain balances, obtains current Uniswap V3 quotes, simulates direct vault deposits when the wallet has balance and allowance, and prepares an unsigned per-user account deployment. Account creation is simulated against the current chain and its returned runtime is compared with the tested compiler output, excluding constructor-set immutable slots. It does not sign, approve, deploy, deposit or trade.

`/api/live/status` reports all funded and background automation flags as false. All wallet, quote, deposit and account-plan routes require Sites identity. Responses are private and uncached; unsupported addresses, symbols and amounts fail closed. The server RPC wrapper only allows reads and simulations, never transaction submission. A dedicated HTTPS RPC can be configured through the optional `ROBINHOOD_RPC_URL` runtime value. The official public RPC is the fallback and has availability/rate limits.

## Tested execution path

Chain 4663. Canonical 6-decimal USDG `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`; Steakhouse USDG vault `0xBeEff033F34C046626B8D0A041844C5d1A5409dd`; Router02 `0xcaf681a66d020601342297493863e78c959e5cb2`; QuoterV2 `0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7`; factory `0x1f7d7550b1b028f7571e69a784071f0205fd2efa`.

The first account constructor allows NVIDIA only: `0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC`. The selected USDG/NVDA fee-500 pool is `0xd4eb21209c4d6093f80b5b84f5c45cc093ea14a3`. Other stock quotes are exploratory; MSFT has no direct fee-500 pool and rejects. The quote service checks half-size versus full-size output to reject exhausted or strongly nonlinear routes; it includes a 1% minimum-output allowance and 60-second validity. These are not execution promises or oracle valuations.

The account has one immutable owner, set to the actual constructor caller. New deposits must leave the principal baseline at or below 100 USDG. Compounded gains can raise that baseline above 100; this is a deposit limit, not a total-assets cap. Only the owner can deposit, withdraw, compound or harvest. There is no operator, arbitrary external call, upgrade or background permission.

Available gains equal account asset value above the recorded principal baseline. Losses must recover before harvest. Direct donations also count as gains; this is not a provenance claim about borrower interest. Holding vault shares already accumulates the vault return. `compound` moves gains into the principal baseline rather than creating another source of yield. Purchases approve exact amounts, enforce stock minimums/deadline, check actual token receipts and reset allowances. Basket legs revert together. Rounding and losses can reduce capital; no principal guarantee is implied.

## Evidence and limits

`contracts/test/` records a local fork of block **58,051,564**, hash `0x1d402c216a49470d2c8dfe856e16846cc333b4da912fc2917f64fa87f9cd3cdc`. Fresh unprivileged wallets received fake balances only on the local chain. No gate overrides, privileged impersonation or public transactions were used.

- Direct vault deposit, partial withdrawal and complete redemption passed.
- Direct 10 fake USDG purchase produced 0.044245277168941167 NVIDIA tokens; onward token transfer passed and the router allowance was exhausted.
- The new account passed **39 assertions**, including ownership, cap, slippage, gains-only budget, actual conversion, full exit, allowance cleanup and atomic rollback on an impossible stock minimum.
- The account test advanced **local time by 30 days**. Genuine adapter accounting at that pinned state produced a surplus, but neither that amount nor time acceleration represents a real deposit, live earnings or a return forecast. A two-micro-USDG buffer was retained for rounding.
- The vault explorer reports a partial source match. Its exact deployed Git commit has not been proven. Local success does not prove future liquidity or eligibility.

Solidity artifact: 0.8.30, optimizer 200, viaIR true, Cancun. `contracts/artifacts/account-standard-input.json` permits exact recompilation. The source/artifact hash is tested automatically. Mainnet deployment is **not complete**.

## Norway pilot and remaining activation work

The intended first participant lives in and is physically located in Norway. NVIDIA's Final Terms explicitly include Norway among non-exempt offer jurisdictions. This is a country-level finding, not approval of freestock or verification of a participant. Non-US-person and prohibited-investor restrictions still apply. The participant's US-person status remains unconfirmed.

The prospectus documents direct secondary blockchain purchases separately from purchases through an Authorised Participant. It also contains broader KYC/AML wording; this work does not assert that a residence checkbox is a completed eligibility verification. No issuer API key is required for the verified direct AMM calls, and no mandatory AMM provider-approval workflow has been established here.

Funded activation still requires participant eligibility to be resolved, an actual participant-wallet deployment, verified deployment identity, a complete wallet submission/receipt workflow, and a fresh actual-sender simulation immediately before each deposit, withdrawal or harvest. The user's wallet must approve every financial transaction. Check spendable withdrawal liquidity and current costs; preview value alone is insufficient. Keep withdrawals available if new deposits or trading are later disabled. Real automation, staking adapters and leveraged LP execution are separate unfinished integrations.

## Verification performed on this version

- 55 unit tests passed, including amount/address validation, exact constructor dependencies, bytecode/source identity and rejection of malformed runtime responses.
- Lint, TypeScript and the production build passed.
- 15 local read-only live API checks passed against current mainnet reads: authentication, input validation, balances, NVIDIA quote, MSFT route rejection, unfunded deposit preview and simulated account creation.
- Existing practice API regression: 12 groups / 46 requests passed in an isolated local database. No hosted account was changed.

## Primary sources

- [Robinhood Chain connection details](https://docs.robinhood.com/chain/connecting/)
- [Morpho Vault V2 contracts](https://docs.morpho.org/developers/contracts/morpho-vaults-v2/)
- [Uniswap deployments](https://developers.uniswap.org/deployments)
- [Issuer token registry](https://api.robinhood.com/rhj/assets)
- [Building with Stock Tokens](https://docs.robinhood.com/chain/building-with-stock-tokens/)
- [NVIDIA Final Terms, Norway on page 8](https://cdn.robinhood.com/assets/robinhood/legal/rhj_final_terms_for_tokenised_debt_securities_linked_to_nvidia.pdf#page=8)
- [Base Prospectus](https://cdn.robinhood.com/assets/robinhood/legal/rhj_base_prospectus.pdf): pages 72, 119, 131 and 150–151 for purchaser, secondary-market and eligibility provisions.
