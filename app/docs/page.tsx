import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EarnShell } from "../earn-shell";
import { STOCKS } from "../../lib/earn-engine";
export default function Page() {
  return (
    <EarnShell active="Docs">
      <div className="earn-wrap education">
        <section className="education-title">
          <span className="earn-eyebrow">PRODUCT DOCUMENTATION / SEPTEMBER 2026</span>
          <h1>
            How freestock
            <br />
            works today.
          </h1>
          <p>
            Mechanics, data sources and the boundary between the working practice product and future
            onchain execution.
          </p>
        </section>
        <div className="education-layout">
          <aside>
            <strong>Contents</strong>
            <a href="#status">Feature status</a>
            <a href="#market-data">Pool coverage</a>
            <a href="#accounting">Position accounting</a>
            <a href="#automation">Automation rules</a>
            <a href="#pricing">Token quantities</a>
            <a href="#storage">Saved records</a>
            <a href="#execution">Live execution design</a>
          </aside>
          <div className="education-body">
            <section id="status">
              <h2>Feature status</h2>
              <div className="earn-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Capability</th>
                      <th>Current behavior</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Pool catalogue</td>
                      <td>Live read-only Morpho API, with a labeled saved-snapshot fallback</td>
                    </tr>
                    <tr>
                      <td>Lending</td>
                      <td>Saved USDG practice positions using a historical vault APY</td>
                    </tr>
                    <tr>
                      <td>Leveraged LP</td>
                      <td>Editable return model; no execution or liquidation engine</td>
                    </tr>
                    <tr>
                      <td>Single stocks and baskets</td>
                      <td>Saved allocation rules and illustrative token purchases</td>
                    </tr>
                    <tr>
                      <td>Auto-convert and compound</td>
                      <td>Run on explicit simulation advances; no background service</td>
                    </tr>
                    <tr>
                      <td>Staking</td>
                      <td>Explained in Learn; no connected strategy</td>
                    </tr>
                    <tr>
                      <td>Wallet and route checks</td>
                      <td>
                        Real balances, live AMM quotes, deposit simulation and unsigned account
                        setup on the Live integration page
                      </td>
                    </tr>
                    <tr>
                      <td>Real deposits and trading</td>
                      <td>Disabled</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            <section id="market-data">
              <h2>Pool coverage and rate meaning</h2>
              <p>
                The initial directory tracks Steakhouse USDG and five listed USDG lending markets on
                Robinhood Chain, chain ID 4663. This is the listed subset verified on September 8,
                2026, not a claim to cover all deployed pools. Underlying collateral: spUSDG, WETH,
                mGLO, syrupUSDG and USDe.
              </p>
              <p>
                Vault assets and market supply overlap. Adding them together would double-count
                capital. All balances shown are USDG token amounts, not an independent USD
                valuation. A listed market is not automatically suitable or executable.
              </p>
              <dl>
                <dt>Vault identity</dt>
                <dd>
                  <code>0xBeEff033F34C046626B8D0A041844C5d1A5409dd</code>
                </dd>
                <dt>Underlying USDG · 6 decimals</dt>
                <dd>
                  <code>0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168</code>
                </dd>
                <dt>Vault APY</dt>
                <dd>
                  Seven-day realized share-price APY, after vault fees and excluding rewards. The
                  practice model does not subtract those vault fees again.
                </dd>
                <dt>Market APY</dt>
                <dd>Seven-day supply APY, excluding rewards. It is not the borrowing rate.</dd>
                <dt>Liquidity</dt>
                <dd>
                  Vault: withdrawable assets from the API. Market: supplied assets minus borrowed
                  assets. These are observations, not a withdrawal guarantee.
                </dd>
                <dt>Freshness</dt>
                <dd>
                  Balances and rates refresh on page load, with up to 60 seconds of server caching.
                  If refresh fails, the entire catalogue uses the dated snapshot. Directory
                  membership is fixed to the verified subset until updated.
                </dd>
              </dl>
              <p>
                <a
                  href="https://docs.morpho.org/developers/api/morpho/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Morpho market API ↗
                </a>{" "}
                ·{" "}
                <a
                  href="https://docs.morpho.org/developers/api/morpho-vaults/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Vault API ↗
                </a>
              </p>
            </section>
            <section id="accounting">
              <h2>How a practice position earns</h2>
              <p>
                Every account starts with 10,000 practice USDG. Creating a position moves capital
                from the practice wallet. Nothing is transferred onchain. The retired prize account
                is preserved separately and does not fund this new simulator.
              </p>
              <h3>Lending scenario</h3>
              <p>
                The observed vault APY is saved when a position opens and held constant for that
                scenario. Each advance calculates{" "}
                <code>capital × ((1 + APY)^(1 / 365) − 1) × days</code>. The APY is converted to a
                daily rate and applied without compounding within a step. Fractions below one
                micro-USDG carry to the next step. Pending earnings sit idle. This is a hypothetical
                continuation of a historical rate, not a live account accrual or forecast.
              </p>
              <h3>LP scenario</h3>
              <p>
                The modeled net annual rate is{" "}
                <code>leverage × (LP fee APR − cost APR) − (leverage − 1) × borrowing APR</code>.
                Each step applies this rate for the selected days, plus any chosen change in the
                total LP position value.
              </p>
              <p>
                Leverage resets to the chosen multiple of current capital at each step. Rebalancing
                costs, price paths, liquidation thresholds, funding availability and real withdrawal
                constraints are not modeled. The LP value-change input represents the whole LP value
                change, including any impermanent loss; it is not an additional loss to subtract
                twice.
              </p>
              <h3>Losses before payouts</h3>
              <p>
                Negative results consume pending earnings, then position capital. Later profits
                restore lost capital before becoming eligible for compounding or stock conversion.
                Modeled equity cannot fall below zero. Real liquidations can occur sooner and
                involve additional costs.
              </p>
              <p>
                Closing returns remaining capital to the practice wallet; earnings of at least 1
                USDG stay attached to the closed position for conversion. Smaller residuals return
                to the practice wallet. Closed positions do not earn or compound. Each position
                keeps its own loss record; the simulator does not combine losses or obligations
                across positions.
              </p>
            </section>
            <section id="automation">
              <h2>Conversion and compounding rules</h2>
              <ol>
                <li>Advance a position by 1, 7 or 30 modeled days.</li>
                <li>Apply the modeled net result and recover any prior capital loss.</li>
                <li>
                  Reinvest the selected compound percentage of new surplus into that position.
                </li>
                <li>Leave the rest as available earnings for stock purchases.</li>
                <li>
                  If auto-convert is enabled and the minimum is reached, convert the available
                  balance into the selected stock allocation.
                </li>
              </ol>
              <p>
                All five steps save together. You can also convert manually once at least 1 practice
                USDG is available, or manually compound pending earnings in an active position.
                Changing allocation weights affects future purchases and does not rebalance existing
                holdings.
              </p>
              <p>
                The minimum is a per-position USDG threshold, not a guaranteed time interval. In
                this version, closing the page runs no jobs and advancing time is always explicit. A
                100% compounding rule sends new surplus back into DeFi; it does not buy stocks.
              </p>
            </section>
            <section id="pricing">
              <h2>Illustrative token quantities</h2>
              <p>
                Practice purchases assume 1 USDG equals $1, use the fixed prices below and omit
                spread, gas and execution fees. They do not use live quotes or represent the price
                at which a real trade could fill.
              </p>
              <div className="model-prices">
                {STOCKS.map((s) => (
                  <div key={s.symbol}>
                    <strong>{s.symbol}</strong>
                    <span>${s.modelPrice} per practice token</span>
                  </div>
                ))}
              </div>
              <p>
                A basket’s weights must total 100%. Allocations use integer micro-USDG, with
                rounding remainder assigned to the final selected token. Token quantities are
                displayed as approximate decimals. Holdings show purchase cost rather than current
                market value.
              </p>
              <p>
                A live route must use current token metadata and an executable quote. Robinhood’s
                REST price endpoint reports underlying-equity prices; token-equivalent prices
                require the current corporate-action multiplier. The onchain feed already applies
                it. Neither read-only endpoint executes a stock purchase.{" "}
                <a
                  href="https://docs.robinhood.com/chain/stock-token-apis/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Stock Token API documentation ↗
                </a>
              </p>
            </section>
            <section id="storage">
              <h2>Saved state and transparent records</h2>
              <p>
                Positions, allocation rules, practice holdings and activity are saved to your
                signed-in account on the server. Duplicate retries reuse the original request
                identifier so the same action is not applied twice. Concurrent actions are checked
                before saving.
              </p>
              <p>
                The <Link href="/transparency">Transparency page</Link> shows each saved entry and
                exports the practice ledger. It reconciles wallet balance, capital, available
                earnings and stock purchase cost against initial funds plus net modeled earnings.
                Compounding is an internal transfer, not additional income.
              </p>
              <p>
                No private keys, wallet signatures or real funds are used. The availability
                self-check is informational and does not store your answers.
              </p>
            </section>
            <section id="execution">
              <h2>What a live version needs to do</h2>
              <p>
                Each supported route must read the user’s actual position, separate principal from
                withdrawable net earnings, account for costs and losses, and preserve required debt
                buffers. It must then withdraw surplus, obtain an executable stock quote or reinvest
                it, submit the authorized transaction and reconcile the confirmed outcome.
              </p>
              <p>
                Automation needs explicit user permissions and limits for spending, slippage, costs
                and conversion size. It should pause when liquidity, eligibility, quotes or token
                status are unsuitable. Partial basket fills need individual receipts and a visible
                unspent balance. Borrowed proceeds are never treated as earnings.
              </p>
              <p>
                The first owner-controlled account has passed 39 checks against a local copy of the
                actual vault, router and NVIDIA pool. The test deposited fake USDG, advanced local
                time, bought NVIDIA tokens from gains and withdrew the remaining assets. No real
                funds or public transactions were involved. The contract is not deployed on mainnet.
                A complete leveraged LP-to-stock strategy has not been verified here.{" "}
                <a
                  href="https://blog.uniswap.org/robinhood-chain-is-live"
                  target="_blank"
                  rel="noreferrer"
                >
                  Uniswap announcement ↗
                </a>
              </p>
              <p>
                The intended launch audience is eligible users outside the US. Country availability,
                issuer restrictions and transaction eligibility still apply; no country has been
                activated for real funds in this app.
              </p>
              <p>
                The intended pilot starts in Norway with a 100 USDG deposit limit and NVIDIA only.
                Eligibility review is pending. The account can reserve gains as principal or
                purchase tokens, but it has no keeper or background spending permission. Vault
                shares already accumulate the underlying return. Donations to an account also count
                as gains; the balance model does not prove that every gain came from borrower
                interest.
              </p>
              <p>
                Basket purchases in this account would execute atomically: if any leg fails its
                minimum output, all legs revert. Microsoft has no verified direct pool at the
                selected fee. A quote alone does not authorize a trade, and withdrawal liquidity
                must be checked again immediately before submission.
              </p>
              <Link href="/live" className="earn-link">
                Open the live integration <ArrowUpRight size={17} />
              </Link>
            </section>
          </div>
        </div>
      </div>
    </EarnShell>
  );
}
