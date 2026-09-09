import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { EarnShell } from '../earn-shell';
import { DemoLink } from '../demo/demo-link';
export const metadata = {
  title: 'Learn how Freestock works',
  description:
    'A practical guide to creating a live lending position, funding it with USDG, choosing stock tokens for available gains, and withdrawing.',
  alternates: { canonical: '/learn' },
};
export default function Page() {
  return (
    <EarnShell active="Learn">
      <div className="earn-wrap education">
        <section className="education-title">
          <span className="earn-eyebrow">THE FREESTOCK GUIDE</span>
          <h1>
            From your wallet
            <br />
            to your first position.
          </h1>
          <p>
            Lend USDG, choose where available gains go, and stay in control of
            every transaction.
          </p>
          <Link href="/dashboard" className="earn-button">
            Open dashboard <ArrowUpRight size={17} />
          </Link>
        </section>
        <div className="education-layout">
          <aside>
            <strong>On this page</strong>
            {[
              ['flow', 'Get started'],
              ['strategies', 'Where gains come from'],
              ['destinations', 'Choose your stocks'],
              ['agentic-lending', 'Agentic Lending'],
              ['portfolio-history', 'Withdraw and track'],
              ['tokens', 'What you receive'],
              ['possibilities', 'What’s available'],
              ['try-it', 'Try it yourself'],
            ].map(([id, label]) => (
              <a href={`#${id}`} key={id}>
                {label}
              </a>
            ))}
          </aside>
          <div className="education-body">
            <section id="flow">
              <h2>Start with your wallet.</h2>
              <p>
                Connect your wallet, switch to Robinhood Chain and confirm a
                free ownership message. Your wallet profile is created
                automatically. You’ll need USDG to lend and a little ETH to pay
                network fees on that chain.
              </p>
              <ol className="live-guide-steps">
                <li>
                  <strong>Create your position.</strong> Freestock checks for
                  saved positions first. For a new position, review the account
                  creation fee and confirm in your wallet. This step uses ETH
                  and does not move your USDG.
                </li>
                <li>
                  <strong>Choose a deposit amount.</strong> Approve exactly how
                  much USDG your account may use. Approval is a permission, not
                  a deposit.
                </li>
                <li>
                  <strong>Confirm the deposit.</strong> Review the separate
                  deposit transaction. Once it confirms, your USDG is in the
                  lending position.
                </li>
                <li>
                  <strong>Choose what to do with gains.</strong> When gains are
                  available, review a stock-token purchase or keep them
                  invested. Your original deposit is tracked separately.
                </li>
              </ol>
              <p>
                Returning with the same wallet? Your saved position is verified
                and restored. If you have several, choose the one you want to
                manage.
              </p>
            </section>
            <section id="strategies">
              <h2>Where your gains come from.</h2>
              <p>
                Freestock puts deposited USDG into the supported Steakhouse
                vault on Morpho. The vault lends through its underlying markets.
                Borrowing demand, fees and losses affect the return, so earnings
                are variable.
              </p>
              <p>
                Your position tracks its current value and a separate principal
                baseline. Only value above that baseline is available for stock
                purchases. If the position loses value, it must recover above
                the baseline before you can spend gains.
              </p>
              <p>
                New accounts have no Freestock deposit cap. Older accounts
                retain their original 100 USDG limit. You can create a separate
                new position from your position’s More actions menu. Wallet
                balances and vault conditions still determine whether a deposit
                can complete.
              </p>
            </section>
            <section id="destinations">
              <h2>Your gains. Your stock picks.</h2>
              <p>
                Buy NVIDIA, Apple, Tesla, Alphabet or SPY Stock Tokens,
                individually or as a weighted basket. Basket percentages divide
                the purchase amount, not your original deposit. Purchased tokens
                go directly to your wallet.
              </p>
              <p>
                Before you approve, Freestock shows an estimate of the tokens
                you’ll receive, the minimum accepted amount and the estimated
                ETH network fee. Prices can move. If the transaction cannot meet
                its limits, it reverts.
              </p>
              <h3>Prefer to keep gains invested?</h3>
              <p>
                You can leave them in the position without doing anything. Vault
                shares already reflect the vault’s performance. “Reserve gains
                as principal” is an optional wallet-approved action that moves
                available gains into the principal baseline and deposits any
                idle account USDG. It does not create another source of return.
              </p>
            </section>
            <section id="agentic-lending">
              <h2>Recommendations. Your approval.</h2>
              <p>
                Agentic Lending checks your available gains, stock choices,
                conversion minimum, purchase limit and fee budgets. It explains
                whether to wait, keep gains invested or review a purchase.
              </p>
              <p>
                It uses rules, not an AI model. It does not send transactions
                automatically. A recommendation leads to a fresh transaction
                review, and your wallet approves the final action.
              </p>
              <p>
                Set your stock picks and minimum conversion amount in the
                dashboard’s Agentic Lending section. You can change or pause
                this plan whenever you want. Save it to your wallet profile and
                turn on background monitoring to receive decisions while you are
                away. Checks can run later than your preferred interval; the
                dashboard shows their status and history.
              </p>
            </section>
            <section id="timing">
              <h2>Let your plan notify you.</h2>
              <p>
                Turn on Purchase-ready alerts in your saved Agentic Lending
                plan. You’ll get an inbox alert when a check finds that your
                purchase rules are met. Enable background checks to keep
                checking while you’re away. In the dashboard’s Alerts popup, you
                can also enable browser notifications, including when Freestock
                is closed on supported browsers.
              </p>
              <p>
                Checks run on a schedule and can be delayed. Open your alert,
                check the plan again and review the purchase. Your wallet still
                approves every transaction. On iPhone or iPad, add Freestock to
                your Home Screen to enable browser notifications.
              </p>
              <h2>Balances update. Purchases need your approval.</h2>
              <p>
                The dashboard refreshes position balances while you are viewing
                it. Lending returns accumulate according to the vault’s
                accounting. That does not mean a new stock purchase happens
                every second.
              </p>
              <p>
                Conversions happen when you choose to review and approve them.
                Transaction costs, available liquidity and confirmation time
                matter. Closing the page does not start an automatic trading
                job.
              </p>
            </section>
            <section id="portfolio-history">
              <h2>Withdraw and follow what happened.</h2>
              <p>
                Use More actions → Withdraw all USDG to review a full exit. When
                liquidity permits and the transaction confirms, the remaining
                USDG returns to your wallet. Stock Tokens already purchased stay
                in your wallet.
              </p>
              <p>
                Activity saves verified position references and transaction
                records to your wallet profile. Receipts show what happened.
                Activity totals cover the records shown, not lifetime profit or
                your complete wallet holdings.
              </p>
              <p>
                If a wallet request is interrupted, Freestock helps you check
                its status before trying again. Keep the transaction hash if you
                need to recover on another device.
              </p>
            </section>
            <section id="tokens">
              <h2>Understand what you receive.</h2>
              <p>
                Stock Tokens provide economic exposure to their linked stocks or
                fund. They are not ownership of the underlying shares. Provider
                terms and restrictions apply; Freestock is intended for non-US
                users and does not determine your eligibility.
              </p>
              <p>
                Capital can lose value. Returns are not guaranteed, and
                withdrawals depend on liquidity. ETH fees are separate from your
                USDG gains.
              </p>
            </section>
            <section id="possibilities">
              <h2>What you can use today.</h2>
              <p>
                Live USDG lending through one configured vault, five stock-token
                choices, baskets, wallet-approved purchases, reserving gains,
                withdrawals and saved activity are available.
              </p>
              <p id="stock-lending">
                Stock-lending markets are shown as live, read-only data. Stock
                deposits, staking, LP strategies, borrowing, pool switching and
                autonomous execution are not enabled in Freestock.
              </p>
              <p id="leverage">
                Leveraged strategies can add borrowing costs and liquidation
                risk. They are outside the current live product. Read the{' '}
                <Link href="/docs">product documentation</Link> for exact
                mechanics and contracts.
              </p>
            </section>
            <section id="try-it">
              <h2>Explore before you deposit.</h2>
              <p>
                <DemoLink>Try it yourself</DemoLink> opens a separate simulation
                with no real funds. Its modeled returns, prices and time
                controls do not affect your wallet or enable live automation.
              </p>
            </section>
          </div>
        </div>
      </div>
    </EarnShell>
  );
}
