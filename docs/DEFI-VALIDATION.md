# DeFi preview validation — September 8, 2026

- Lint and TypeScript checks passed.
- 50 unit tests passed, including 15 new DeFi accounting tests and retained historical-data checks.
- 12 isolated local API groups passed across 46 HTTP requests: identity, request bounds, cross-origin rejection, duplicate/concurrent commands, account isolation, baskets, split conversion/compounding, loss recovery, closure and retired prize commands. No hosted account balances were changed by the test runner.
- The production build completed and `/`, `/learn`, `/docs`, `/transparency` returned HTTP 200 on the local production Worker.
- New tables are added in the append-only `0001_faulty_betty_brant.sql` migration. The original prize account tables are preserved.
- Read-only Morpho coverage is one tracked vault and five verified listed USDG markets. Fallback snapshots carry timestamps; that September 8 release did not enable real money or stock transactions. See [Live accounts](LIVE-ACCOUNTS.md) for current behavior.
- No browser interaction, screenshot, mobile-device or assistive-technology testing was requested or performed in this update. Responsive rules, semantic controls, local image paths and reduced-motion behavior were inspected in source.
