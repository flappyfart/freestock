import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { EarnShell } from "../earn-shell";
import { DemoLink } from "../demo/demo-link";
export default function Page() {
  return (
    <EarnShell active="Learn">
      <div className="earn-wrap education">
        <section className="education-title">
          <span className="earn-eyebrow">THE FREESTOCK FIELD GUIDE</span>
          <h1>
            Make your earnings
            <br />
            go somewhere <em>you choose.</em>
          </h1>
          <p>
            Understand how lending gains can become stock-token exposure, what compounding means,
            and how costs and losses affect the result. Explore the idea with simulated money.
          </p>
          <DemoLink className="earn-button">
            Try it yourself <ArrowUpRight size={17} />
          </DemoLink>
        </section>
        <div className="education-layout">
          <aside>
            <strong>On this page</strong>
            <a href="#flow">The basic idea</a>
            <a href="#agentic-lending">Agentic Lending</a>
            <a href="#strategies">Where earnings come from</a>
            <a href="#stock-lending">Lending Stock Tokens</a>
            <a href="#destinations">Convert or compound</a>
            <a href="#timing">Can it happen in real time?</a>
            <a href="#leverage">Understanding leverage</a>
            <a href="#tokens">What you receive</a>
            <a href="#possibilities">What’s available today</a>
          </aside>
          <div className="education-body">
            <section id="flow">
              <span className="earn-eyebrow">01 / THE IDEA</span>
              <h2>
                Earn in one place.
                <br />
                Build exposure in another.
              </h2>
              <p>
                Imagine putting 100 USDG into a lending strategy. If it generates 1 USDG of
                available net earnings, that 1 could go toward your chosen Stock Tokens. Your
                original capital stays in the strategy unless you withdraw it or the strategy loses
                money.
              </p>
              <div className="learn-flow">
                <div>
                  <b>1</b>
                  <strong>Choose a strategy</strong>
                  <span>Lending, or an LP scenario in the model.</span>
                </div>
                <ArrowRight size={20} />
                <div>
                  <b>2</b>
                  <strong>Check available gains</strong>
                  <span>Recover losses, then review conversion costs.</span>
                </div>
                <ArrowRight size={20} />
                <div>
                  <b>3</b>
                  <strong>Choose its destination</strong>
                  <span>Your stock picks, more DeFi capital, or both.</span>
                </div>
              </div>
              <p className="learn-callout">
                <DemoLink>Try it yourself</DemoLink> opens a simulation modal with setup, results
                and activity. Its scenarios and holdings use no real funds. For a live position,
                choose Connect Wallet on Home, then use <Link href="/dashboard">Dashboard</Link>.
                The private pilot’s access limits still apply, and every real transaction requires
                the owner’s wallet approval.
              </p>
            </section>
            <section id="agentic-lending">
              <h2>A lending plan with a reason for the next move.</h2>
              <p>
                <Link href="/dashboard?view=agentic">Agentic Lending</Link> checks the available
                surplus in your Freestock account against your chosen rules. It can suggest waiting
                for more gains, keeping vault shares invested or reviewing a stock purchase.
                Recommendations use live position data; they are separate from the simulated
                scenarios.
              </p>
              <p>
                Choose your stock allocation, a minimum amount of available gains and an ETH
                network-fee limit. Request a quote when the minimum is met. A recommendation to
                review is not a trade or a claim that the trade is profitable. You still check the
                final cost and approve any transaction in your wallet.
              </p>
              <p>
                The first release is rule-based recommendation mode. It uses one lending vault, does
                not call an AI model and does not move funds automatically. Plans are saved on this
                browser, and checks stop when the view is closed. Keeping gains invested needs no
                transaction because vault shares already accumulate underlying returns.
              </p>
            </section>
            <section id="portfolio-history">
              <h2>Follow what actually happened.</h2>
              <p>
                <Link href="/dashboard?view=activity">Portfolio Activity</Link>{' '}
                keeps verified positions and transaction records with your
                signed-in profile. Return with the same wallet to see saved
                deposits, withdrawals, reserved gains and stock purchases.
                Purchases show the tokens actually received, rather than the
                earlier quote.
              </p>
              <p>
                Use Sync from chain to import older account events, or import a
                transaction hash when an approval or failed transaction is
                missing. The coverage indicator tells you whether more history
                remains. Page totals describe the listed transactions; they are
                not your current wallet holdings, total interest or profit.
              </p>
              <p>
                The first live run guide walks through a deposit, a decision
                about available gains, and a withdrawal. Each action still needs
                your wallet approval. Saving activity and connecting your wallet
                never move funds.
              </p>
            </section>
            <section id="strategies">
              <span className="earn-eyebrow">02 / THE SOURCES</span>
              <h2>“Earn” can mean different things.</h2>
              <article>
                <h3>Lending</h3>
                <p>
                  You supply assets that borrowers use and receive variable interest. A curated
                  vault can distribute deposits across lending markets. Returns depend on borrowing
                  demand, fees and losses. Withdrawals depend on available liquidity.{" "}
                  <a
                    href="https://docs.morpho.org/learn/concepts/vault-v2/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    How Morpho vaults work ↗
                  </a>
                </p>
              </article>
              <article>
                <h3>Staking</h3>
                <p>
                  You help secure a proof-of-stake network and earn protocol rewards. Penalties,
                  withdrawal queues and claim schedules vary. Some products call themselves
                  “staking” even when rewards come from lending or trading, so understand the actual
                  source. No staking strategy is connected to freestock yet.{" "}
                  <a href="https://ethereum.org/staking/" target="_blank" rel="noreferrer">
                    Ethereum staking explained ↗
                  </a>
                </p>
              </article>
              <article>
                <h3>Providing liquidity (LP)</h3>
                <p>
                  You supply assets to a trading pool and earn a share of eligible swap fees.
                  Trading changes the mix of assets you hold. You can end up worse off than if you
                  had simply held them. A concentrated position stops earning fees while outside its
                  selected price range. Freestock offers an LP demo model, but no LP or leveraged LP
                  execution.{" "}
                  <a
                    href="https://support.uniswap.org/hc/en-us/articles/37113550065549-What-are-the-risks-when-providing-liquidity"
                    target="_blank"
                    rel="noreferrer"
                  >
                    LP risks ↗
                  </a>
                </p>
              </article>
            </section>
            <section id="stock-lending">
              <h2>Can you lend Stock Tokens?</h2>
              <p>
                Yes. Five verified Morpho markets on Robinhood Chain use AAPL, GOOGL, NVDA, SPY or
                TSLA Stock Tokens as the asset being lent. Borrowers post USDG as collateral.
                Freestock now shows these markets on Home and Dashboard as live market data only;
                stock deposits are not enabled here.
              </p>
              <h3>Same token in. Same token earned.</h3>
              <p>
                For example, a lender supplies NVDA tokens. When someone borrows them, the borrower
                owes NVDA tokens plus variable interest. The lender’s claim is denominated in NVDA
                tokens, and withdrawals depend on available liquidity. This does not turn tokens
                into direct ownership of NVIDIA shares.
              </p>
              <p>
                This differs from Freestock’s USDG vault: that route earns in USDG, then lets the
                owner approve a purchase of chosen Stock Tokens. Direct stock lending earns in the
                token supplied; it does not automatically convert interest into another stock or
                basket.
              </p>
              <p className="learn-callout">
                No borrowing means no borrower-paid interest. These five markets were empty and
                showed 0% supply APY when checked on September 9, 2026 (UTC). The market feed shows
                current observations as they change. A deployed market alone does not establish
                demand or future returns.
              </p>
              <p>
                Stock prices, token restrictions, collateral, pricing feeds and borrower defaults
                can affect the outcome. Read the{" "}
                <Link href="/docs#stock-lending">market checks and current limits</Link>, or open{" "}
                <Link href="/#home-pools-title">Stock lending on Home</Link> to explore the data.
              </p>
            </section>
            <section id="destinations">
              <span className="earn-eyebrow">03 / YOUR RULES</span>
              <h2>Convert. Compound. Or split.</h2>
              <p>
                Choose your rules in the modal’s <DemoLink>setup view</DemoLink>, then advance the
                saved scenario in its <DemoLink view="results">results view</DemoLink>. The rules
                run only when you advance a scenario and do not authorize real transactions.
              </p>
              <p>
                First choose how your capital earns, then choose Buy stocks, Reinvest or Split both.
                Your earnings plan shows each destination as a share of new earnings. Your deposit
                stays allocated to the earning strategy; the stock percentages apply to earnings.
              </p>
              <div className="learn-options">
                <article>
                  <h3>Demo auto-convert</h3>
                  <p>
                    Build up available earnings, then buy your chosen Stock Tokens when the
                    conversion minimum is reached. Choose one stock or a basket whose weights total
                    100%.
                  </p>
                </article>
                <article>
                  <h3>Demo auto-compound</h3>
                  <p>
                    Reinvest available earnings into the same DeFi position. A larger position can
                    generate more earnings and also has more capital exposed to the strategy’s
                    risks.
                  </p>
                </article>
                <article>
                  <h3>Demo split</h3>
                  <p>
                    For example, reinvest 40% and direct 60% toward stocks. From 10 USDG of net
                    earnings, 4 stays in DeFi and 6 goes toward your chosen basket.
                  </p>
                </article>
              </div>
              <p>
                A basket splits each new purchase; it does not rebalance tokens you already hold.
                Buying Stock Tokens does not itself produce DeFi yield. Automatically reinvesting
                their proceeds would require a separate supported strategy.
              </p>
              <p className="earn-small">
                Example amounts are illustrative, not a return forecast. The live pilot has no
                background auto-conversion or automatic split rule.
              </p>
              <p>
                The demo’s conversion minimum waits for a stock budget of your chosen size. It does
                not check whether a purchase is economical, and the simulation excludes conversion
                fees. In the live flow, compare the quoted stock amount and minimum received with
                the separately displayed ETH gas estimate. A small purchase can cost too much
                relative to the gains you are converting.
              </p>
              <p>
                In your live account, vault shares already reflect the underlying return without a
                new signature. Reserving gains increases recorded principal and deposits any idle
                account USDG into the vault. Buying stock tokens uses available gains. Both actions
                require the owner to review and approve a wallet transaction.
              </p>
            </section>
            <section id="timing">
              <span className="earn-eyebrow">04 / THE TIMING</span>
              <h2>
                Earnings can accrue.
                <br />
                Purchases need approval.
              </h2>
              <p>
                A lending position may accrue interest continuously, while staking rewards may
                appear only at checkpoints or when claimed. A moving earnings counter is not proof
                that the funds can already be withdrawn.
              </p>
              <div className="timing-stages">
                <article>
                  <strong>Accrued</strong>
                  <p>The strategy has recorded or estimated earnings.</p>
                </article>
                <article>
                  <strong>Available</strong>
                  <p>
                    Earnings can be withdrawn after costs, losses and any required debt buffers.
                  </p>
                </article>
                <article>
                  <strong>Converted or reinvested</strong>
                  <p>The purchase or reinvestment has executed and its transaction is confirmed.</p>
                </article>
              </div>
              <p>
                The live account refreshes its balances while the page is visible. Those read-only
                updates do not request a signature or execute a purchase. You choose when to request
                a stock purchase or reserve gains, then approve the transaction in your wallet. A
                purchase needs enough withdrawal liquidity and a usable quote. Basket purchases are
                atomic, so every leg must meet its minimum output for the purchase to complete.
              </p>
              <p>
                Background auto-conversion is not implemented. Small earnings can accumulate until
                you choose to trade, and vault returns can change or turn negative. A moving balance
                or price alone does not execute a purchase.{" "}
                <a
                  href="https://docs.robinhood.com/chain/stock-token-apis/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Robinhood’s price API ↗
                </a>
              </p>
            </section>
            <section id="leverage">
              <span className="earn-eyebrow">05 / BORROWED EXPOSURE</span>
              <h2>Leverage increases the downside too.</h2>
              <p>
                At 2× leverage, 1,000 of your own capital supports 2,000 of exposure using 1,000
                borrowed. In a simplified annual example, 10% LP fees produce 200, 6% borrowing
                costs use 60, and 1% costs on exposure use 20. That leaves 120 before price changes,
                losses and any other costs.
              </p>
              <p>
                Those inputs are assumptions, not live rates. A 10% fall in the modeled LP value
                costs 200 before fees and interest: 20% of the original equity. Borrowing costs
                continue even when swap fees fall. Real leveraged positions can be liquidated; the
                freestock scenario does not simulate their liquidation thresholds.
              </p>
              <p>
                Leaving a concentrated LP range is different from liquidation. An ordinary
                unborrowed LP position does not get liquidated merely because its price leaves the
                range.{" "}
                <a
                  href="https://support.uniswap.org/hc/en-us/articles/7423614928909-Do-I-get-liquidated-if-the-price-goes-outside-of-my-range"
                  target="_blank"
                  rel="noreferrer"
                >
                  Understand the difference ↗
                </a>
              </p>
            </section>
            <section id="tokens">
              <span className="earn-eyebrow">06 / WHAT YOU HOLD</span>
              <h2>Stock exposure through a token.</h2>
              <p>
                Robinhood Stock Tokens are tokenized debt securities issued by Robinhood Assets
                (Jersey) Limited. They provide economic exposure without legal or beneficial
                ownership of the underlying shares. Country and user eligibility restrictions apply.{" "}
                <a href="https://docs.robinhood.com/rhj/" target="_blank" rel="noreferrer">
                  Issuer explanation ↗
                </a>
              </p>
              <p>
                Stock prices can fall after a purchase. A basket of related companies can fall
                together. Neither a familiar stock name nor a lending pool makes returns guaranteed.
              </p>
            </section>
            <section id="possibilities">
              <span className="earn-eyebrow">07 / CURRENT ACCESS</span>
              <h2>What you can use today.</h2>
              <p>
                The private pilot is enabled for the configured signed-in account. Connecting a
                wallet does not grant private access. There is no separate eligibility form; stock
                provider terms and restrictions still apply. The pilot uses one USDG lending vault
                with a 100 USDG deposit limit. Available stock-token routes are NVDA, AAPL, TSLA,
                GOOGL and SPY.
              </p>
              <p>
                The owner can create an account, deposit, buy selected tokens with available gains,
                reserve gains as principal and withdraw. Every transaction requires wallet approval.
                You can restore an existing live account using its creation transaction reference;
                the account must match the connected owner and supported route. The builder’s local
                execution checks used fake funds. The builder has not deployed a public account or
                submitted real transactions.
              </p>
              <p>
                <DemoLink>Try it yourself</DemoLink> keeps simulated setup,{" "}
                <DemoLink view="results">results</DemoLink> and{" "}
                <DemoLink view="activity">activity</DemoLink> together in one modal. All demo
                amounts are simulated and use no real funds. Staking, leveraged LP execution and
                background auto-conversion are not implemented. Live vault shares can accrue their
                underlying return without another signature; buying stock tokens still requires your
                approval.
              </p>
              <Link href="/dashboard" className="earn-link">
                Open Dashboard <ArrowUpRight size={17} />
              </Link>
              <p>
                <Link href="/docs" className="earn-link">
                  See the exact current mechanics <ArrowUpRight size={17} />
                </Link>
              </p>
            </section>
          </div>
        </div>
      </div>
    </EarnShell>
  );
}
