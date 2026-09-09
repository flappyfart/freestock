# Intended non-US DeFi launch

> Historical development record. The single-participant access restriction was removed on 9 September 2026. See [current backend behavior](BACKEND.md), [contracts](CONTRACTS.md) and the [roadmap](PRODUCT-MILESTONES.md). Dated tests below retain their original scope; they are not funded production transactions.

The active product is DeFi earnings directed to Stock Token purchases or reinvestment. The old prize/draw design is superseded. At the early September 8 checkpoint recorded here, Freestock accepted simulated funds only. Current live wallet behavior is documented in [Live accounts](LIVE-ACCOUNTS.md).

The early build used an informational issuer-restriction self-check in `lib/launch-policy.ts` for residence, current location and Regulation S US-person status. Answers are not sent or stored. Passing this self-check does not authorize a deposit or purchase. Stock Tokens are economic exposures, not underlying share ownership.

Live activation requires supported jurisdictions and a verified transaction path per strategy: position accounting, withdrawals, available net earnings, costs and loss recovery, debt buffers where relevant, quotes, token status, signed permissions and reconciliation. Auto-conversion and compounding must be bounded by the user's preferences and executable liquidity. Staking rewards may not be immediately claimable; leveraged LP support needs an actual borrowing and collateral route.

At that checkpoint, the integration covered read-only Morpho data; lending and LP simulations; single-token and basket allocations; and simulated threshold conversions and compounding. It did not move real funds or run background automation. The app’s Learn and Docs pages describe current behavior.
