"use client";
/* oxlint-disable next/no-img-element -- Local transparent decorative artwork; fixed dimensions prevent layout shift. */
import { useState } from "react";
import { ArrowRight, Clock3, Gift, Wallet } from "lucide-react";
import { EXAMPLE_POOLS, prizeProjection, type ExamplePool } from "@/lib/prize-projection";
import { AvailabilityCheck } from "./availability-check";

const displayMoney = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
const poolLabels: Record<ExamplePool, string> = {
  100000: "$100K",
  1000000: "$1M",
  10000000: "$10M",
};

export function HomepageIntro() {
  const [examplePool, setExamplePool] = useState<ExamplePool>(1_000_000);
  const projection = prizeProjection(examplePool);
  const prize = displayMoney(projection.weeklyPrize);
  return (
    <section className="home-intro" aria-labelledby="home-title">
      <div className="hero-artwork" aria-hidden="true">
        {(["aapl", "nvda", "msft"] as const).map((stock) => (
          <span className={`stock-bubble stock-bubble--${stock}`} key={stock}>
            <img
              src={`/stocks/bubble-${stock}.webp`}
              alt=""
              width="1024"
              height="1024"
              fetchPriority={stock === "nvda" ? "high" : "auto"}
            />
          </span>
        ))}
      </div>
      <div className="home-intro-copy">
        <p className="small-label">
          ILLUSTRATION · {poolLabels[examplePool]} SAVINGS POOL · ONE WEEKLY WINNER
        </p>
        <h1 id="home-title">
          Save $100.
          <br />
          Get a shot at <span className="projection-prize">~{prize}</span> in stock tokens.
        </h1>
        <p className="home-description">
          The idea: pool digital dollars, earn interest from lending, and use that interest to fund
          stock-token prizes. A random draw picks the winner.
        </p>
        <a className="primary arrow-button home-cta" href="#try-demo">
          Try a simulated draw
          <span className="arrow-capsule" aria-hidden="true">
            <ArrowRight size={17} />
          </span>
        </a>
        <p className="home-demo-note">Simulated draws use $10 prizes. No real money or stocks.</p>
        <AvailabilityCheck />
        <p className="home-tradeoff">
          The earnings go to prizes, instead of interest paid to every saver. Your deposit isn’t
          spent on the draw.
        </p>
        <fieldset className="projection-controls">
          <legend>Explore a bigger pool</legend>
          {EXAMPLE_POOLS.map((pool) => (
            <button
              key={pool}
              type="button"
              aria-pressed={examplePool === pool}
              onClick={() => setExamplePool(pool)}
              aria-label={`Illustrate a ${displayMoney(pool)} savings pool`}
            >
              {poolLabels[pool]}
            </button>
          ))}
        </fieldset>
        <p className="projection-assumptions">
          Assumes 4% annual earnings, with 10% of earnings covering costs. The remaining weekly
          earnings go to one winner. Illustrative rates and rules, not promised returns.
        </p>
      </div>

      <div className="money-story panel" aria-labelledby="money-story-title">
        <div className="money-story-heading">
          <h2 id="money-story-title">Your $100. A much bigger possibility.</h2>
          <span className="story-example">{poolLabels[examplePool]} POOL ILLUSTRATION</span>
        </div>
        <ol className="money-steps">
          <li>
            <span className="money-step-icon" aria-hidden="true">
              <Wallet size={20} />
            </span>
            <div>
              <span className="story-step-label">01 · SAVE</span>
              <h3>You put $100 into savings</h3>
              <p>It joins an example pool with {poolLabels[examplePool]} in total deposits.</p>
            </div>
          </li>
          <li>
            <span className="money-step-icon" aria-hidden="true">
              <Clock3 size={20} />
            </span>
            <div>
              <span className="story-step-label">02 · BUILD ENTRIES</span>
              <h3>$100 × 7 days = 700 entries</h3>
              <p>
                Example chance: 1 in {projection.oneInOdds.toLocaleString("en-US")}, if everyone
                keeps their balance for the full week.
              </p>
            </div>
          </li>
          <li>
            <span className="money-step-icon" aria-hidden="true">
              <Gift size={20} />
            </span>
            <div>
              <span className="story-step-label">03 · THE DRAW</span>
              <h3>One saver wins about {prize} in stock tokens</h3>
              <p>The pool’s earnings after costs pay for it. Winning is never guaranteed.</p>
            </div>
          </li>
        </ol>
        <div className="story-outcomes">
          <div>
            <span>If you don’t win</span>
            <strong>$100 in savings</strong>
          </div>
          <div>
            <span>If you win</span>
            <strong>
              $100 <small>+ ~{prize} in stock tokens</small>
            </strong>
          </div>
        </div>
        <p className="story-note">
          This illustration assumes a constant {poolLabels[examplePool]} pool and one winner
          receiving the entire weekly prize budget. Your chance depends on your share of all
          entries. It does not change the $10 simulated draws in your account.
        </p>
      </div>
      <p className="home-risk-note">
        This demo keeps your deposit balance unchanged by the draw. A future live product could lose
        deposited money, and withdrawals could be delayed.
      </p>
    </section>
  );
}

const questions = [
  [
    "Who is freestock being built for?",
    "The planned launch is for eligible users outside the United States. US persons and people in the US cannot participate in the planned stock-token product. Other country restrictions also apply. Being outside the US does not automatically establish eligibility. Live availability has not been confirmed for any country; the demo is available to explore now.",
  ],
  [
    "Why does the homepage show a bigger prize than my simulated draw?",
    "The headline illustrates what a larger pool could fund. At $1M in total deposits, a hypothetical 4% annual return generates $40,000 a year. Deducting 10% of those earnings as costs leaves $36,000, or about $690 per seven days. This example awards all of that weekly budget to one winner. Actual returns and future draw rules could differ. The interactive demo account still uses fixed $10 prizes.",
  ],
  [
    "Where does the prize money come from?",
    "The proposed live product would lend pooled USDG, a digital dollar token, to earn interest. After costs, that interest would fund stock-token prizes instead of being paid to every saver. These earnings are often called yield. Deposits themselves are not the prize budget. Here, the demo only calculates pretend earnings; it does not lend real money.",
  ],
  [
    "What happens if I don’t win?",
    "You receive no prize, and the draw does not reduce your simulated savings balance. For example, $100 saved is still $100 after an unsuccessful draw, provided you haven’t withdrawn it. This is how the demo works, not a guarantee that a future live product would protect your money.",
  ],
  [
    "How do entries and winning chances work?",
    "Each simulated dollar saved for one day earns one entry. Save $100 for seven days and you earn 700 entries. Your chance is your entries divided by everyone’s entries in that draw. For example, 10% of all entries means a 10% chance. Entries start fresh for each weekly demo draw; more entries never guarantee a win.",
  ],
  [
    "Can I take my money out?",
    "Yes, in the demo. Choose Withdraw, enter an amount, confirm the request, then select Complete simulated withdrawal. The money returns to your demo wallet. A requested withdrawal stops earning new entries, but entries already earned still count. A future live product would depend on available funds and could have withdrawal delays.",
  ],
  [
    "Are these real dollars or real stocks?",
    "No. You start with $10,000 of simulated money, labeled USDG, and four pretend savers share your example pool. A $10 stock prize is a pretend dollar credit, not a share or token. The planned non-US product would award Robinhood Stock Tokens, which provide economic exposure to a stock without ownership rights in the underlying shares. Real deposits and stock purchases are disabled.",
  ],
] as const;

export function HomepageQuestions() {
  return (
    <section className="home-questions" aria-labelledby="questions-title">
      <div className="questions-heading">
        <p className="small-label">THE DETAILS, IN PLAIN ENGLISH</p>
        <h2 id="questions-title">A few things worth knowing.</h2>
      </div>
      <div className="questions-list">
        {questions.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <span aria-hidden="true">+</span>
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
