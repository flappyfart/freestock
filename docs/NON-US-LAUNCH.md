# Non-US launch scope

Decision: September 8, 2026. The user selected a non-US product. The proposed funding asset is USDG on Robinhood Chain; prizes are Robinhood Stock Tokens. A US brokerage delivery path is not in this launch scope. No country has been approved for live participation and no financial integration is activated.

## Availability policy

US persons, anyone in the US (including territories and possessions), and anyone acting for a US person's account or benefit are excluded from the planned stock-token product. US citizenship is not a substitute for the Regulation S definition. Residence, physical location and account/beneficial-owner status require separate consideration.

The issuer FAQ excludes US, Canadian, UK and Swiss residents. Its restricted-jurisdictions page also names Cuba, Belarus, Iran, North Korea, Russia, Syria, Ukraine, South Sudan, Sudan, Myanmar and Venezuela. These lists are not exhaustive permission to serve other countries. Other completed self-check responses remain pending; missing or uncertain answers remain unconfirmed.

Sources checked September 8, 2026:

- [Stock-token overview and US-person restrictions](https://docs.robinhood.com/chain/stock-tokens/)
- [Issuer FAQ](https://docs.robinhood.com/rhj/faq/)
- [Restricted jurisdictions](https://docs.robinhood.com/rhj/restricted-jurisdictions/)
- [Regulation S definitions](https://www.ecfr.gov/current/title-17/chapter-II/part-230/section-230.902)

The current availability check is informational. Answers stay in component memory and are never sent or saved. It neither verifies identity nor enforces live financial access. Demo access stays available and existing practice balances and claims are untouched. Future financial APIs and contracts must require their own verified eligibility; a browser answer cannot authorize funds.

## Next implementation sequence

1. Prove a fresh unprivileged wrapper can deposit canonical USDG into the identified Morpho vault and redeem its actual shares on a pinned mainnet fork. Preserve transaction traces and balance changes. Read-only gate calls do not prove this.
2. Prove an executable stock-token purchase and recipient transfer through a supported venue. Reconcile actual token quantities, underlying-share multiplier, prices, costs and failure states. Metadata and price feeds alone do not supply trade execution.
3. Implement the shared pool, realized-yield budget, loss accounting, withdrawals and immutable time-weighted entry snapshots. The current independent per-user scenarios are not a shared ledger.
4. Implement Chainlink VRF on a supported chain and authenticated result transport to Robinhood Chain, with separately retryable settlement. No rerolls or duplicate awards. Verify current deployments again before implementation.
5. Connect wallet transactions, confirmed balances and event indexing to the existing interface. Pending transactions must not appear as settled deposits or claimed prizes.
6. Establish the operating entity, provider access, selected-country product rules and eligibility process, funded operating budget, monitoring and withdrawal recovery. Then rehearse the complete flow before a capped pilot in explicitly approved countries.

Live deposits, lending, stock execution, geographic enforcement and verified onboarding remain unimplemented. The current publication is a practice product for the selected non-US direction, not a live launch.
