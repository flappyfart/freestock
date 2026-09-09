> Historical record: this document describes the retired prize preview. See README.md and the in-app Docs for the active DeFi product.

> Historical development record. The single-participant access restriction was removed on 9 September 2026. See [current backend behavior](BACKEND.md), [contracts](CONTRACTS.md) and the [roadmap](PRODUCT-MILESTONES.md). Dated tests below retain their original scope; they are not funded production transactions.

# Verification record

September 8, 2026.

- 26 deterministic engine tests pass: micro-USDG precision, principal/yield conservation, weighting, boundaries, snapshot immutability, randomness persistence, settlement/claims, and finite scenario limits.
- 12 isolated compiled-Worker integration groups pass across 84 HTTP requests. Includes authentication, owner separation, 4 KB limit, content type, strict command schema, origin enforcement, duplicate-key replay and concurrent writes. Two intentional contention responses were retried with stable request keys. HTTP sampling naturally selected an example saver; user-winning claims are covered deterministically by engine tests.
- App, domain code and tests pass TypeScript and lint. Unmodified generated UI library code is excluded from lint; the full project remains typechecked.
- npm dependency scan reports zero known vulnerabilities after compatible security updates. The esbuild override is exercised by build and migration generation.
- Generated D1 migration inspected; no subsequent schema changes required.
- Read-only network probe passes its offline tests and both pinned-chain support/gate checks. Evidence in docs/evidence. These checks do not submit transactions.
- Responsive layout, keyboard-capable Base UI dialogs/tabs, reduced-motion and reduced-transparency rules implemented. Browser interaction, screenshots, mobile rendering and assistive-technology QA have not been performed in this turn.
- Optional WebMCP tools are feature-detected and cleaned up on page teardown. No supported WebMCP browser validation context was used; tool execution remains unverified.
- The design skill installation contains only SKILL.md; its referenced product guide and detector script are absent. The available guidance and supplied style reference were applied without claiming the absent automated check ran.

At this September 8 checkpoint, funded activation was disabled. These historical tests do not establish production readiness; current live wallet behavior is documented in [Live accounts](LIVE-ACCOUNTS.md).
