/* oxlint-disable next/no-img-element -- Locally generated decorative SVG; fixed dimensions prevent layout shift. */
import { ArrowRight, Clock3, Gift, Wallet } from "lucide-react";

export function HomepageIntro() {
  return (
    <section className="home-intro" aria-labelledby="home-title">
      <div className="particle-orb" aria-hidden="true">
        <img src="/particle-orb.svg" alt="" width="640" height="640" />
      </div>
      <div className="home-intro-copy">
        <p className="small-label">SAVINGS WITH A CHANCE TO WIN</p>
        <h1 id="home-title">
          Your savings could win you <em>stock prizes.</em>
        </h1>
        <p className="home-description">
          The idea: pool savings, earn interest from lending, and use that interest to fund stock
          prizes. A random draw picks the winner.
        </p>
        <p className="home-tradeoff">
          The earnings go to prizes, instead of interest paid to every saver. Your deposit isn’t
          spent on the draw.
        </p>
        <a className="primary arrow-button home-cta" href="#try-demo">
          Try with practice money
          <span className="arrow-capsule" aria-hidden="true">
            <ArrowRight size={17} />
          </span>
        </a>
        <p className="home-demo-note">An interactive demo. No real money or stocks.</p>
      </div>

      <div className="money-story panel" aria-labelledby="money-story-title">
        <div className="money-story-heading">
          <h2 id="money-story-title">Follow a $100 deposit</h2>
          <span className="story-example">DEMO EXAMPLE</span>
        </div>
        <ol className="money-steps">
          <li>
            <span className="money-step-icon" aria-hidden="true">
              <Wallet size={20} />
            </span>
            <div>
              <span className="story-step-label">01 · SAVE</span>
              <h3>You put $100 into savings</h3>
              <p>It joins the pool alongside other savers’ deposits.</p>
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
                Save more, or for longer, to build more entries. More entries mean a better chance.
              </p>
            </div>
          </li>
          <li>
            <span className="money-step-icon" aria-hidden="true">
              <Gift size={20} />
            </span>
            <div>
              <span className="story-step-label">03 · THE DRAW</span>
              <h3>One saver wins a $10 stock prize</h3>
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
              $100 <small>+ $10 prize</small>
            </strong>
          </div>
        </div>
        <p className="story-note">
          Example only. Weekly demo draws need enough pool earnings. Prizes are pretend dollar
          credits.
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
    "Where does the prize money come from?",
    "The proposed live product would lend the pooled digital dollars to earn interest. After costs, that interest would fund stock prizes instead of being paid to every saver. These earnings are often called yield. Deposits themselves are not the prize budget. Here, the demo only calculates pretend earnings; it does not lend real money.",
  ],
  [
    "What happens if I don’t win?",
    "You receive no prize, and the draw does not reduce your practice savings balance. For example, $100 saved is still $100 after an unsuccessful draw, provided you haven’t withdrawn it. This is how the demo works, not a guarantee that a future live product would protect your money.",
  ],
  [
    "How do entries and winning chances work?",
    "Each practice dollar saved for one day earns one entry. Save $100 for seven days and you earn 700 entries. Your chance is your entries divided by everyone’s entries in that draw. For example, 10% of all entries means a 10% chance. Entries start fresh for each weekly demo draw; more entries never guarantee a win.",
  ],
  [
    "Can I take my money out?",
    "Yes, in the demo. Choose Withdraw, enter an amount, confirm the request, then select Complete simulated withdrawal. The money returns to your practice wallet. A requested withdrawal stops earning new entries, but entries already earned still count. A future live product would depend on available funds and could have withdrawal delays.",
  ],
  [
    "Are these real dollars or real stocks?",
    "No. You start with $10,000 of practice money, labeled USDG, and four pretend savers share your example pool. USDG is a digital dollar token proposed for the live product; here it is only a simulated balance. A $10 stock prize is a pretend dollar credit, not a share or token. A future live version is intended to award stock tokens. Real deposits and stock purchases are disabled.",
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
