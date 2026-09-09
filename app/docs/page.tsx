import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { EarnShell } from '../earn-shell';
import { DemoLink } from '../demo/demo-link';
import { ENABLED_STOCKS } from '../../lib/live/basket';
import { USDG, VAULT, EXPLORER_URL } from '../../lib/live/config';
export const metadata = {
  title: 'Live product documentation',
  description:
    'Freestock live account setup, lending accounting, stock purchases, transaction permissions, contracts, recovery and supported markets.',
  alternates: { canonical: '/docs' },
};
const repo = 'https://github.com/flappyfart/freestock';
export default function Page() {
  return (
    <EarnShell active="Docs">
      <div className="earn-wrap education">
        <section className="education-title">
          <span className="earn-eyebrow">LIVE PRODUCT DOCUMENTATION</span>
          <h1>
            How Freestock
            <br />
            works.
          </h1>
          <p>
            Account setup, lending mechanics, stock purchases and transaction
            recovery. For a practical walkthrough, start with{' '}
            <Link href="/learn">Learn</Link>.
          </p>
          <Link className="earn-button" href="/dashboard">
            Open dashboard <ArrowUpRight size={17} />
          </Link>
        </section>
        <div className="education-layout">
          <aside>
            <strong>Contents</strong>
            {[
              ['status', 'Supported features'],
              ['execution', 'Create and fund'],
              ['accounting', 'Balances and gains'],
              ['earnings-plan', 'Stocks and baskets'],
              ['pricing', 'Quotes and fees'],
              ['agentic-lending', 'Agentic Lending'],
              ['agent-monitoring', 'Monitoring and limits'],
              ['purchase-alerts', 'Purchase-ready alerts'],
              ['storage', 'Activity and recovery'],
              ['market-data', 'Lending market data'],
              ['stock-lending', 'Stock lending'],
              ['contracts', 'Contracts and backend'],
              ['security-assessment', 'Security assessment'],
              ['automation', 'Automation status'],
              ['demo', 'Simulator'],
            ].map(([id, label]) => (
              <a href={`#${id}`} key={id}>
                {label}
              </a>
            ))}
          </aside>
          <div className="education-body">
            <section id="status">
              <h2>Supported live features</h2>
              <div className="docs-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Current behavior</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>USDG lending</td>
                      <td>
                        One configured Steakhouse vault through a personal
                        account owned by your wallet.
                      </td>
                    </tr>
                    <tr>
                      <td>Stock purchases</td>
                      <td>
                        NVDA, AAPL, TSLA, GOOGL and SPY, individually or in an
                        atomic basket.
                      </td>
                    </tr>
                    <tr>
                      <td>Agentic Lending</td>
                      <td>
                        Rule-based recommendations. Every transaction requires
                        wallet approval.
                      </td>
                    </tr>
                    <tr>
                      <td>Gains and withdrawals</td>
                      <td>
                        Buy stocks with available gains, reserve gains as
                        principal, or withdraw the remaining USDG.
                      </td>
                    </tr>
                    <tr>
                      <td>Activity</td>
                      <td>
                        Saved position references, verified receipts, bounded
                        history imports and exports.
                      </td>
                    </tr>
                    <tr>
                      <td>New account deposits</td>
                      <td>
                        No Freestock deposit cap. Legacy V1 accounts retain
                        their fixed 100 USDG limit.
                      </td>
                    </tr>
                    <tr>
                      <td>Stock-lending market feeds</td>
                      <td>Read-only. No stock deposit or borrowing actions.</td>
                    </tr>
                    <tr>
                      <td>Staking, LP and unattended execution</td>
                      <td>Not enabled for real transactions.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            <section id="execution">
              <h2>Create and fund a position</h2>
              <ol className="live-guide-steps">
                <li>
                  <strong>Connect your wallet.</strong> Switch to Robinhood
                  Chain, chain ID 4663, then confirm a free ownership message.
                  This creates or opens your wallet profile, without moving
                  funds or approving token spending.
                </li>
                <li>
                  <strong>Restore or create.</strong> Freestock checks saved
                  positions before offering creation. A new position deploys a
                  personal account from your wallet. Review the ETH fee, then
                  approve the deployment.
                </li>
                <li>
                  <strong>Approve an exact USDG amount.</strong> The approval
                  names your verified account as spender and only authorizes the
                  amount you reviewed. Freestock does not request unlimited USDG
                  allowance.
                </li>
                <li>
                  <strong>Deposit separately.</strong> A second transaction
                  moves USDG into the account and configured lending vault.
                  Approval alone does not start lending.
                </li>
                <li>
                  <strong>Manage your position.</strong> Once confirmed, use
                  available gains for stocks, reserve them as principal, add
                  funds or withdraw.
                </li>
              </ol>
              <p>
                You need USDG and ETH on Robinhood Chain. Wallet balances,
                network fees, vault conditions and transaction simulation
                determine whether an action can proceed.
              </p>
              <h3>New and existing accounts</h3>
              <p>
                New V2 accounts have no Freestock deposit cap. Older V1 accounts
                cannot be upgraded: their 100 USDG principal limit is immutable.
                Existing positions remain restorable and withdrawable. Use More
                actions → Create another position to create a V2 account; funds
                are not migrated automatically.
              </p>
              <p>
                A new account does not increase your token allowance
                automatically. Each new deposit still requires an exact
                allowance and a wallet-approved transaction.
              </p>
            </section>
            <section id="accounting">
              <h2>Balances, principal and available gains</h2>
              <pre>
                <code>{`Account value = redeemable vault shares + idle USDG\nAvailable surplus = max(account value − principal baseline, 0)\nStock budget = max(available surplus − 0.000002 USDG, 0)`}</code>
              </pre>
              <p>
                The principal baseline is an accounting value, not a guarantee
                of capital. Deposits increase it, withdrawals reduce it, and a
                full exit clears it. Losses must recover above the baseline
                before new gains can be spent.
              </p>
              <p>
                Direct USDG or vault-share donations also increase surplus.
                Available gains are therefore not a ledger proving that every
                increase came from borrower interest. The two-micro-USDG reserve
                helps cover rounding.
              </p>
              <p>
                Holding vault shares already reflects the vault’s performance.
                “Reserve gains as principal” increases the baseline and deposits
                idle account USDG. It does not create extra yield.
              </p>
            </section>
            <section id="earnings-plan">
              <h2>Stock choices and baskets</h2>
              <p>
                Select a stock or weighted basket and choose how much available
                surplus to spend. Weights must total 100%. The purchase budget
                is separate from your deposited principal.
              </p>
              <div className="docs-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Stock Token</th>
                      <th>Contract on Robinhood Chain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENABLED_STOCKS.map((stock) => (
                      <tr key={stock.symbol}>
                        <td>{stock.symbol}</td>
                        <td>
                          <a
                            href={`${EXPLORER_URL}/address/${stock.address}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {stock.address.slice(0, 10)}…
                            {stock.address.slice(-8)} ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Purchased tokens go to the account owner’s wallet. Basket legs
                execute atomically: if any required swap cannot meet its
                minimum, the entire purchase reverts. Stock Tokens provide
                economic exposure, not ownership of underlying shares.
              </p>
            </section>
            <section id="pricing">
              <h2>Quotes, limits and network fees</h2>
              <p>
                Live purchases use actual Uniswap V3 quotes. Each review shows
                estimated token receipts, minimum receipts and an estimated ETH
                network fee. The supported routes use a 0.05% pool fee included
                in the quote. The minimum allows 1% less output than the quote,
                rounded down.
              </p>
              <p>
                Freestock checks half-size and full-size quotes to reject
                unavailable or strongly nonlinear routes. Larger purchases can
                still fail liquidity checks. A quote is not a guaranteed
                execution price.
              </p>
              <p>
                Prepared transaction reviews expire after 45 seconds. Stock
                transactions use a 120-second onchain deadline. Deposit previews
                require at least 99.9% of the quoted vault shares. The displayed
                ETH estimate includes a 20% gas-limit buffer; your wallet shows
                the final fee.
              </p>
              <p>
                Every action is simulated for the actual sender before the
                wallet prompt. Changes to liquidity, balances, gas, prices or
                the network can still cause a submitted transaction to revert
                and consume gas.
              </p>
            </section>
            <section id="agentic-lending">
              <h2>Agentic Lending: recommendations you control</h2>
              <p>
                The current engine uses deterministic rules. It checks your
                verified position, available surplus, stock allocation,
                conversion minimum, purchase limit, pause state and fee budgets.
              </p>
              <p>
                It can recommend waiting, retaining gains or reviewing a
                purchase. Stale data, losses, a pending wallet request or
                insufficient gains prevent a purchase recommendation. A review
                always requests fresh transaction details.
              </p>
              <p>
                Plans and decision history are saved to your wallet profile for
                each position. They do not grant spending permissions. There is
                no AI model, operator signer or unattended trader. A
                recommendation becomes a transaction only after your explicit
                wallet approval.
              </p>
            </section>
            <section id="agent-monitoring">
              <h2>Background monitoring and cost limits</h2>
              <p>
                Save a plan and turn on “Check while you’re away” to queue
                background recommendations every 15 minutes, hour or six hours.
                Scheduled runs may be delayed. The dashboard shows the service
                status, last check, next eligible check and saved reasons for
                waiting.
              </p>
              <p>
                The agent caps each proposed purchase and compares estimated ETH
                gas plus pool fees with your chosen percentage of the purchase.
                ETH is valued in USDG using Chainlink ETH/USD and USDG/USD,
                checked against their published 24-hour heartbeat. The source
                timestamps are shown; the estimate excludes price movement and
                slippage. It is not a guaranteed execution cost.
              </p>
              <p>
                Pause stops future background checks and invalidates work in
                progress. Saved decisions are historical records, not reusable
                quotes. Select Check now for a new estimate, then Review
                purchase. The final preparation rechecks the saved plan and fee
                limits before opening your wallet review. Changing the saved
                plan requires checking it again.
              </p>
              <p>
                Plans restore when the same wallet reconnects on another device.
                The latest 50 decisions are displayed and up to 100 retained per
                position. Manual checks are limited to one completed check per
                30 seconds. Failed checks retry with a delay. Monitoring neither
                signs transactions nor switches lending pools.
              </p>
            </section>
            <section id="purchase-alerts">
              <h2>Purchase-ready alerts</h2>
              <p>
                In Agentic Lending, turn on Purchase-ready alerts and save the
                plan. Turn on Check while you’re away for scheduled checks when
                the site is closed. A successful purchase recommendation adds a
                private, dated alert to your dashboard inbox. Consecutive ready
                checks update that alert without repeatedly notifying you. A
                later successful check that no longer meets the rules ends that
                alert; readiness can then create a new one. Temporary read
                failures do not generate new alerts.
              </p>
              <p>
                Open Alerts in your dashboard and choose Enable browser alerts
                to opt in on a supported browser. Allow the browser’s permission
                prompt. The notification contains no balances, stock picks or
                wallet addresses. This browser is linked to the connected
                wallet; explicitly enabling another wallet replaces that link.
                You can turn notifications off in Alerts or browser settings. Up
                to five browsers can be linked to one wallet.
              </p>
              <p>
                On iPhone and iPad, add Freestock to your Home Screen and open
                it there before enabling notifications. Browser settings,
                operating-system delivery and the scheduled checking queue can
                delay or suppress notifications. This is not an instant price
                alert or guaranteed delivery service. Enabling browser
                notifications applies to future ready alerts, not earlier inbox
                entries.
              </p>
              <p>
                An alert is historical evidence, not an order or reusable quote.
                Open the plan, select Check now, then Review purchase if its
                current rules still pass. Every purchase needs wallet approval.
                Editing, pausing, disabling alerts or removing a plan
                invalidates its outstanding alerts and queued notifications. A
                notification already accepted by a browser provider may still
                arrive. The inbox displays the latest 50 alerts across the
                wallet and retains up to 100 per position.
              </p>
            </section>
            <section id="storage">
              <h2>Activity, restoration and recovery</h2>
              <p>
                Activity saves verified account references and transaction
                records to your wallet profile. Restoring a reference rechecks
                the deployment, contract code, owner and configured dependencies
                against the chain.
              </p>
              <p>
                History imports scan a bounded range and can resume after
                partial scans or chain reorganizations. Approvals, failures and
                replacement transactions may need a separate hash import. Direct
                transfers are outside the account-event scan. Totals and exports
                cover displayed records, not lifetime profit or complete wallet
                holdings.
              </p>
              <p>
                Pending wallet requests use a device-local journal. It records
                enough information to check submission, cancellation or
                replacement without repeating an uncertain transaction. A
                pending request takes priority over new actions. Keep its hash
                when recovering on another device.
              </p>
              <p>
                A profile-saving error does not undo a confirmed financial
                transaction. The chain receipt is the record of execution. Retry
                saving through Activity, not by repeating the deposit or
                purchase.
              </p>
              <p>
                To exit, use More actions → Withdraw all USDG. The full
                remaining account value returns to the owner when liquidity and
                the transaction’s minimum permit. Purchased Stock Tokens stay in
                the wallet.
              </p>
            </section>
            <section id="market-data">
              <h2>Lending market coverage</h2>
              <p>
                The homepage and market explorer show data for the tracked
                Morpho USDG vault and lending markets. A listed market is not
                automatically an executable strategy in Freestock. The live
                account currently uses one configured Steakhouse vault.
              </p>
              <p>
                Displayed historical APYs describe an observed period and may
                change. They are not fixed rates or return forecasts. Vault
                rates already reflect the vault’s accounting; deposits and
                withdrawals depend on its current conditions.
              </p>
              <p>
                Feeds include observation times. If a live source is
                unavailable, any retained snapshot is labeled with its
                timestamp. Missing information is not silently replaced by a
                claimed live rate.
              </p>
            </section>
            <section id="stock-lending">
              <h2>Stock lending: market data only</h2>
              <p>
                Freestock tracks AAPL, GOOGL, NVDA, SPY and TSLA loan-asset
                markets with USDG borrower collateral. Amounts are Stock Tokens,
                not dollars. These markets are read-only in Freestock; stock
                deposits, borrowing and withdrawals are not enabled.
              </p>
              <p>
                A 0% historical supply APY with zero balances means the observed
                market has no lending activity. It does not indicate a promised
                future rate. Available tokens means unborrowed tokens, not
                guaranteed withdrawal liquidity.
              </p>
              <p>
                The inspected price adapters can accept stock prices up to four
                days old. This is one reason a listing is not an approval to
                enable deposits. Read the{' '}
                <a
                  href={`${repo}/blob/main/docs/STOCK-LENDING.md`}
                  target="_blank"
                  rel="noreferrer"
                >
                  market evidence and limitations ↗
                </a>
                .
              </p>
            </section>
            <section id="contracts">
              <h2>Contracts and backend</h2>
              <p>
                Each user deploys their own <code>FreestockYieldAccount</code>.
                There is no shared Freestock account, factory or project-token
                contract configured.
              </p>
              <ul>
                <li>
                  USDG:{' '}
                  <a
                    href={`${EXPLORER_URL}/address/${USDG}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {USDG}
                  </a>
                </li>
                <li>
                  Steakhouse vault:{' '}
                  <a
                    href={`${EXPLORER_URL}/address/${VAULT}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {VAULT}
                  </a>
                </li>
              </ul>
              <p>
                The owner and dependencies are fixed at creation. The account
                has no operator, arbitrary external-call permission or upgrade
                authority. V1 and V2 deployments are recognized by their exact
                creation data and version-specific runtime.
              </p>
              <p>
                The backend reads chain state, prepares unsigned transactions,
                verifies receipts and stores user-scoped history. It has no
                wallet private key and does not broadcast transactions.
                Connecting your wallet opens your profile. Only the account
                owner’s wallet can authorize account actions.
              </p>
              <p>
                <a
                  href={`${repo}/blob/main/docs/CONTRACTS.md`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Full contract reference ↗
                </a>{' '}
                ·{' '}
                <a
                  href={`${repo}/blob/main/docs/BACKEND.md`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Backend guide ↗
                </a>{' '}
                ·{' '}
                <a href={repo} target="_blank" rel="noreferrer">
                  Public source ↗
                </a>
              </p>
              <p>
                Tests include local chain forks with fake funds. They do not
                prove future liquidity. A wallet-approved 1 USDG deposit and
                full withdrawal were verified on 9 September 2026; a funded
                stock conversion remains unverified. Real funds can lose value;
                provider restrictions apply.
              </p>
            </section>
            <section id="security-assessment">
              <span className="earn-eyebrow">
                9 SEPTEMBER 2026 · SOURCE REVIEW
              </span>
              <h2>Security assessment</h2>
              <p>
                The project-supplied, QuillAudits-branded report records{' '}
                <strong>PASS for the source controls it reviewed</strong>:
                application architecture, wallet authentication, API boundaries,
                the account contract, dependencies and operational controls.
              </p>
              <p>
                Its scope is the public repository and documentation. The full
                scope qualification is on page 7. This source review does not
                certify the live deployment or subsequent product changes.
              </p>
              <a
                className="earn-button"
                href="/reports/freestock-source-review-2026-09-09.pdf"
                target="_blank"
                rel="noreferrer"
              >
                Read the full report <ArrowUpRight size={17} />
              </a>
              <p>
                <a
                  href={`${repo}/blob/main/docs/SECURITY-ASSESSMENT.md`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Scope, document provenance and file hash on GitHub ↗
                </a>
              </p>
            </section>
            <section id="automation">
              <h2>What automation does today</h2>
              <p>
                Balance refreshes, recommendation checks and receipt
                reconciliation help you manage the account. They do not sign or
                execute financial actions. Stock purchases and reserving gains
                are wallet-approved actions.
              </p>
              <p>
                Background conversion, delegated execution, automatic pool
                switching, staking and leveraged LP strategies are not
                implemented. Those require additional contracts, permissions and
                execution paths.
              </p>
            </section>
            <section id="demo">
              <h2>Separate simulator</h2>
              <p>
                <DemoLink>Try it yourself</DemoLink> explores the concept with
                simulated money, illustrative prices and explicit time
                advancement. It is separate from the live account and cannot
                move real funds or enable automation.
              </p>
            </section>
          </div>
        </div>
      </div>
    </EarnShell>
  );
}
