import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EarnShell } from "../earn-shell";
import { DemoLink } from "../demo/demo-link";
import stockLendingRegistry from "../../lib/stock-lending-registry.json";
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
            Current mechanics, data sources and private wallet pilot limits. For the concepts behind
            lending, compounding and stock-token exposure, start with{" "}
            <Link href="/learn">Learn</Link>.
          </p>
        </section>
        <div className="education-layout">
          <aside>
            <strong>Contents</strong>
            <a href="#status">Feature status</a>
            <a href="#market-data">Pool coverage</a>
            <a href="#stock-lending">Stock lending</a>
            <a href="#accounting">Demo accounting</a>
            <a href="#automation">Demo automation</a>
            <a href="#pricing">Token quantities</a>
            <a href="#storage">Saved records</a>
            <a href="#execution">Wallet pilot</a>
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
                      <td>Stock-lending markets</td>
                      <td>
                        Live read-only data for AAPL, GOOGL, NVDA, SPY and TSLA. No stock deposits,
                        approvals or withdrawals are enabled in Freestock.
                      </td>
                    </tr>
                    <tr>
                      <td>Try it yourself</td>
                      <td>
                        <DemoLink>Opens the simulation modal</DemoLink> with setup, results and
                        activity in one place; all amounts are simulated and use no real funds
                      </td>
                    </tr>
                    <tr>
                      <td>Demo results</td>
                      <td>
                        <DemoLink view="results">
                          Saved simulated positions, balances and holdings
                        </DemoLink>{" "}
                        inside the modal, with controls to advance the model; no real positions
                      </td>
                    </tr>
                    <tr>
                      <td>Live USDG lending</td>
                      <td>
                        One vault for the enabled participant, with a 100 USDG deposit limit and
                        wallet approval for each transaction
                      </td>
                    </tr>
                    <tr>
                      <td>Leveraged LP</td>
                      <td>Editable return model; no execution or liquidation engine</td>
                    </tr>
                    <tr>
                      <td>Live stock-token purchases</td>
                      <td>
                        Manually buy NVDA, AAPL, TSLA, GOOGL or SPY with available account gains;
                        quotes and purchases are reviewed in Dashboard
                      </td>
                    </tr>
                    <tr>
                      <td>Demo auto-convert and compound</td>
                      <td>Run only when you advance a scenario; no background stock conversion</td>
                    </tr>
                    <tr>
                      <td>Staking</td>
                      <td>Explained in Learn; no connected strategy</td>
                    </tr>
                    <tr>
                      <td>Dashboard</td>
                      <td>
                        Live balances, participant status, account recovery, transaction review and
                        read-only refresh while the page is visible
                      </td>
                    </tr>
                    <tr>
                      <td>Access</td>
                      <td>
                        Private pilot for the configured signed-in account; connecting a wallet does
                        not grant access
                      </td>
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
                  demo model does not subtract those vault fees again.
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
            <section id="stock-lending">
              <h2>Stock lending: live data, read-only access</h2>
              <p>
                Home’s Stock lending view and Dashboard track five Morpho markets whose loan asset
                is a Robinhood Stock Token. Borrowers supply USDG collateral. These are separate
                from the USDG lending markets above. Freestock does not prepare or submit
                transactions for these stock-lending markets.
              </p>
              <div className="earn-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Loan asset</th>
                      <th>Collateral</th>
                      <th>Verified market source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockLendingRegistry.markets.map((market) => (
                      <tr key={market.id}>
                        <td>{market.symbol} · 18 decimals</td>
                        <td>USDG · 6 decimals</td>
                        <td>
                          <a
                            href={`https://api.morpho.org/v0/blue/markets/4663:${market.id}/state`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {market.id.slice(0, 10)}…{market.id.slice(-6)} ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                The market IDs were recomputed from each exact loan token, collateral token, oracle,
                interest-rate model and liquidation threshold, then matched to the deployed Morpho
                contract. All five use a 62.5% liquidation loan-to-value threshold. Their loan token
                addresses match Robinhood’s asset registry.
              </p>
              <h3>What the figures mean</h3>
              <p>
                Supplied, borrowed and available amounts are quantities of that row’s Stock Token,
                not dollars or an aggregate stock valuation. Available tokens equal supplied minus
                borrowed tokens. The displayed APY is the seven-day supply APY, excluding rewards;
                it is not the borrowing rate and does not forecast your return. Lenders earn in the
                same token they supply.
              </p>
              <p>
                At block 58,196,418 (September 9, 2026, 02:39:15 UTC), all five markets had zero
                supply, borrowing and liquidity. The API also reported 0% seven-day supply APY.
                These are dated observations. With no borrowing there is no borrower-paid interest.
              </p>
              <p>
                The feed requests Morpho’s state and historical-rate endpoints separately. A missing
                rate stays unavailable while valid balances remain visible; a failed balance read
                never becomes zero. Successful responses may be cached for 60 seconds, incomplete
                responses for 15 seconds. The page checks each minute while visible, labels retained
                responses when updates fail, and exposes the source’s indexed blocks. “Live API
                data” describes a successful API response, not a guarantee that the upstream indexer
                is current.
              </p>
              <h3>What was checked before listing</h3>
              <p>
                A local fork passed 60 checks across the five markets: supplying tokens, recording
                shares, rejecting unauthorized withdrawals, collateralized borrowing,
                insufficient-liquidity behavior, repayment with accrued interest and withdrawing the
                same token. These checks used synthetic funds in a local chain. They did not submit
                public transactions or establish future returns.
              </p>
              <p>
                The custom price adapters accepted stock prices up to four days old and USDG prices
                up to 26 hours old in the inspected configuration. A two-day-old stock price was
                still accepted. The primary and secondary stock proxies shared an underlying
                aggregator, so they were not independent price sources. Stock-token feeds already
                incorporate the corporate-action multiplier; applying it again would misprice the
                token.
              </p>
              <p>
                Verified adapter source was not available from the checked source services, and no
                official Robinhood sequencer-uptime feed was established. The review is limited to
                observed contracts, prices and local behavior. Stock lending remains data-only in
                Freestock.
              </p>
              <p>
                <a
                  href="https://mast.bond/journal/lending-is-live-on-mast"
                  target="_blank"
                  rel="noreferrer"
                >
                  Mast lending announcement ↗
                </a>
                {" · "}
                <a href="https://api.robinhood.com/rhj/assets" target="_blank" rel="noreferrer">
                  Robinhood asset registry ↗
                </a>
                {" · "}
                <a
                  href="https://docs.morpho.org/learn/concepts/blue/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Morpho lending mechanics ↗
                </a>
                {" · "}
                <a
                  href="https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json"
                  target="_blank"
                  rel="noreferrer"
                >
                  Chainlink feed registry ↗
                </a>
              </p>
            </section>
            <section id="accounting">
              <h2>How a simulated position earns</h2>
              <p>
                Open <DemoLink>Try it yourself</DemoLink> to set up a scenario in the simulation
                modal. Each demo account starts with 10,000 simulated USDG. Creating a scenario
                moves capital from the demo wallet; it does not create or fund a real position.
                After the save is confirmed, the modal’s{" "}
                <DemoLink view="results">results view</DemoLink> shows your saved simulated
                positions, balances and holdings. The retired prize account is preserved separately
                and does not fund this simulator.
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
                Closing returns remaining capital to the demo wallet; earnings of at least 1 USDG
                stay attached to the closed position for conversion. Smaller residuals return to the
                demo wallet. Closed positions do not earn or compound. Each position keeps its own
                loss record; the simulator does not combine losses or obligations across positions.
              </p>
            </section>
            <section id="automation">
              <h2>Demo conversion and compounding rules</h2>
              <p>
                These rules apply when you advance a scenario in the modal’s{" "}
                <DemoLink view="results">results view</DemoLink>. They do not authorize transactions
                in your live account.
              </p>
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
                All five steps save together. You can also convert manually once at least 1
                simulated USDG is available, or manually compound pending earnings in an active
                position. Changing allocation weights affects future purchases and does not
                rebalance existing holdings.
              </p>
              <p>
                The minimum is a per-position USDG threshold, not a guaranteed time interval. In
                demo mode, closing the page runs no jobs and advancing time is always explicit. A
                100% compounding rule sends modeled surplus back into the simulated position; it
                does not buy stocks.
              </p>
              <p>
                Live vault shares reflect the underlying return without a new wallet signature. The
                pilot has no background auto-conversion service. Reserving gains as principal or
                converting available gains into stock tokens requires a transaction that the owner
                reviews and approves.
              </p>
            </section>
            <section id="pricing">
              <h2>Illustrative token quantities</h2>
              <p>
                Simulated purchases assume 1 USDG equals $1, use the fixed prices below and omit
                spread, gas and execution fees. They do not use live quotes or represent the price
                at which a real trade could fill.
              </p>
              <div className="model-prices">
                {STOCKS.map((s) => (
                  <div key={s.symbol}>
                    <strong>{s.symbol}</strong>
                    <span>${s.modelPrice} per simulated token</span>
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
                Simulated positions, allocation rules, simulated holdings and activity are saved to
                your signed-in account on the server. Duplicate retries reuse the original request
                identifier so the same action is not applied twice. Concurrent actions are checked
                before saving.
              </p>
              <p>
                The simulation modal’s <DemoLink view="results">results view</DemoLink> shows saved
                simulated positions, balances and holdings. Its{" "}
                <DemoLink view="activity">activity view</DemoLink> provides the detailed ledger and
                JSON export. It reconciles wallet balance, capital, available earnings and stock
                purchase cost against initial funds plus net modeled earnings. Compounding is an
                internal transfer, not additional income.
              </p>
              <p>
                The demo account uses no real funds. Dashboard keeps the live account separate: the
                owner reviews and signs transactions in their connected wallet. Transaction recovery
                references are saved in this browser. You can restore a live account from its
                creation transaction reference, which is checked against the connected owner and
                supported route. Live balances and receipts are read from chain. Freestock has no
                separate country questionnaire. Stock provider terms and restrictions still apply.
              </p>
            </section>
            <section id="execution">
              <h2>The private wallet pilot</h2>
              <p>
                Choose Connect Wallet on Home, then create or manage your live position in{" "}
                <Link href="/dashboard">Dashboard</Link>. New deposits and stock purchases are
                limited to the configured signed-in account. This private access does not verify
                eligibility for the stock provider’s services. General registration for live actions
                is not enabled.
              </p>
              <p>
                The pilot supports one USDG lending vault, a 100 USDG deposit limit and purchases of
                NVIDIA (NVDA), Apple (AAPL), Tesla (TSLA), Alphabet (GOOGL) and SPY Stock Tokens.
                The owner can create an account, deposit, reserve available gains as principal,
                purchase selected tokens and withdraw. Every transaction requires wallet approval;
                connecting or refreshing the page does not submit one.
              </p>
              <p>
                The live account reads its actual assets and recorded principal before preparing an
                action. Losses reduce the gains available for conversion. Donations to an account
                also count as gains, so this balance model does not prove that every gain came from
                borrower interest. Reserving gains increases recorded principal. Existing vault
                shares continue earning, and any idle USDG in the account is deposited into the
                vault as part of that approved action.
              </p>
              <p>
                Stock purchases use current quotes and withdrawal availability, not the simulator’s
                prices. Basket purchases execute atomically: if any leg fails its minimum output,
                the whole purchase reverts. Confirmed purchases record actual USDG spent and tokens
                received. A quote alone does not authorize a trade.
              </p>
              <p>
                Live balances refresh while the page is visible. This is read-only monitoring, not
                background transaction permission. Vault shares accrue their underlying return
                without a new signature, but stock conversion and reserving gains remain manual,
                wallet-approved actions. Background auto-conversion, staking and leveraged LP
                execution are not implemented.
              </p>
              <p>
                Local execution checks used fake funds against a local copy of the route. The
                builder has not deployed a public account or submitted real transactions. A
                participant must create and fund their own account through wallet-approved
                transactions. Country, issuer and transaction restrictions still apply.
              </p>
              <Link href="/dashboard" className="earn-link">
                Open Dashboard <ArrowUpRight size={17} />
              </Link>
            </section>
          </div>
        </div>
      </div>
    </EarnShell>
  );
}
