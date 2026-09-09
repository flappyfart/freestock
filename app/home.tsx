"use client";
/* oxlint-disable next/no-img-element -- Existing optimized local stock artwork. */
import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Play, ScanLine, SlidersHorizontal, Check } from "lucide-react";
import { EarnShell } from "./earn-shell";
import { LandingIntro } from "./landing-intro";
import { useDemo, type DemoView } from "./demo/demo-provider";
import { DemoLink } from "./demo/demo-link";
import { useWalletConnection } from "./live/wallet-provider";
import { HomePools } from "./home-pools";
export default function Home() {
  const { openDemo } = useDemo();
  const { requestConnect, owner } = useWalletConnection();
  useEffect(() => {
    const followDemoLink = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("demo");
      const hash = window.location.hash;
      if (view && ["setup", "results", "activity"].includes(view)) openDemo(view as DemoView);
      else if (["#practice-results", "#demo-results", "#positions"].includes(hash))
        openDemo("results");
      else if (hash === "#try-it-yourself") openDemo("setup");
    };
    followDemoLink();
    window.addEventListener("hashchange", followDemoLink);
    return () => window.removeEventListener("hashchange", followDemoLink);
  }, [openDemo]);
  return (
    <EarnShell active="Home">
      <LandingIntro />
      <div className="home-flow">
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="earn-eyebrow">AGENTIC LENDING. YOUR STOCK PICKS.</span>
            <h1>
              Keep lending.
              <br />
              Grow your <em>stocks.</em>
            </h1>
            <p>
              Give your lending a plan. Agentic Lending checks your available gains and helps you
              decide when to put them toward the stock tokens you choose.
            </p>
            <div className="home-hero-actions">
              {owner ? (
                <Link href="/dashboard" className="earn-button">
                  Your dashboard <ArrowUpRight size={18} />
                </Link>
              ) : (
                <button type="button" className="earn-button" onClick={requestConnect}>
                  Connect wallet <ArrowUpRight size={18} />
                </button>
              )}
              <DemoLink className="home-demo-button">
                <Play size={16} /> Try it yourself
              </DemoLink>
            </div>
            <p className="home-hero-note">
              Private wallet pilot · Up to 100 USDG deposited
              <br />
              Returns vary. Capital can lose value.
            </p>
          </div>
          <div className="home-stock-scene" aria-hidden="true">
            <div className="home-stock-apple">
              <img src="/stocks/bubble-aapl.webp" width="260" height="260" alt="" />
              <span className="home-stock-apple-label">APPLE</span>
            </div>
            <img
              className="home-stock-sandisk"
              src="/stocks/bubble-sndk.webp"
              width="260"
              height="260"
              alt=""
            />
            <img
              className="home-stock-nvidia"
              src="/stocks/bubble-nvda.webp"
              width="380"
              height="380"
              alt=""
            />
            <span className="home-stock-caption">Earnings, meet your stock picks.</span>
          </div>
        </section>
        <section className="home-agentic" aria-labelledby="agentic-title">
          <div className="home-agentic-copy">
            <span className="home-agentic-label">
              <ScanLine size={18} /> Agentic Lending
            </span>
            <h2 id="agentic-title">
              Your plan.
              <br />A clearer next move.
            </h2>
            <p>
              Know when to wait, keep gains invested or review a stock purchase. Freestock checks
              your position against your plan and shows the reason for every recommendation.
            </p>
            <Link href="/dashboard?view=agentic" className="earn-button">
              Explore Agentic Lending <ArrowUpRight size={18} />
            </Link>
            <small>Recommendation mode · Rule-based checks · You approve transactions</small>
          </div>
          <div className="home-agentic-flow" aria-label="How Agentic Lending works">
            <div>
              <ScanLine size={21} />
              <span>
                <strong>Read your position</strong>
                <small>Live balance, principal baseline and available gains.</small>
              </span>
            </div>
            <div>
              <SlidersHorizontal size={21} />
              <span>
                <strong>Check your plan</strong>
                <small>Your stock picks, conversion minimum and gas budget.</small>
              </span>
            </div>
            <div>
              <Check size={21} />
              <span>
                <strong>Explain the next move</strong>
                <small>A reason to wait, hold or open a fresh transaction review.</small>
              </span>
            </div>
            <p>
              One connected lending vault today.
              <br />
              Pool switching and automatic execution are planned.
            </p>
          </div>
        </section>
        <section className="home-how" aria-labelledby="how-title">
          <div className="home-how-heading">
            <div>
              <h2 id="how-title">Your lending. Your stock picks. One clear flow.</h2>
            </div>
            <Link href="/learn" className="earn-link">
              How it works <ArrowUpRight size={17} />
            </Link>
          </div>
          <ol>
            <li>
              <span className="home-step-number">01</span>
              <h3>Put USDG to work</h3>
              <p>
                Connect your wallet and create a lending position. The pilot uses the Steakhouse
                USDG vault on Robinhood Chain.
              </p>
            </li>
            <li>
              <span className="home-step-number">02</span>
              <h3>Choose where gains go</h3>
              <p>
                Pick NVIDIA, Apple, Tesla, Alphabet or SPY tokens. Split a purchase across a basket,
                or keep gains in your lending position.
              </p>
            </li>
            <li>
              <span className="home-step-number">03</span>
              <h3>Follow every purchase</h3>
              <p>
                See the available budget, estimated gas and minimum tokens before you approve.
                Confirmed purchases link to their onchain receipt.
              </p>
            </li>
          </ol>
        </section>
        <section className="home-demo-invitation">
          <div>
            <h2>Build your earnings plan.</h2>
            <p>
              Choose a lending scenario, pick your stocks and decide how much to reinvest. Explore
              the results with simulated money before connecting a wallet.
            </p>
          </div>
          <DemoLink className="earn-button">
            Try it yourself <ArrowRight size={18} />
          </DemoLink>
        </section>
        <HomePools />
      </div>
    </EarnShell>
  );
}
