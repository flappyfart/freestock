"use client";
/* oxlint-disable next/no-img-element -- Existing optimized local stock artwork. */
import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Play } from "lucide-react";
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
            <span className="earn-eyebrow">DEFI EARNINGS. YOUR STOCK PICKS.</span>
            <h1>
              Your yield.
              <br />
              Your next <em>stock.</em>
            </h1>
            <p>
              Lend USDG. Let returns accumulate. Put available earnings toward NVIDIA, Apple, Tesla,
              Alphabet or SPY Stock Tokens.
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
        <HomePools />
        <section className="home-how" aria-labelledby="how-title">
          <div className="home-how-heading">
            <div>
              <span className="earn-eyebrow">A CLEAR PATH</span>
              <h2 id="how-title">One account. Three steps.</h2>
            </div>
            <Link href="/learn" className="earn-link">
              How it works <ArrowUpRight size={17} />
            </Link>
          </div>
          <ol>
            <li>
              <span className="home-step-number">01</span>
              <h3>Connect & create</h3>
              <p>
                Connect your wallet, then create or restore your lending account in the dashboard.
              </p>
            </li>
            <li>
              <span className="home-step-number">02</span>
              <h3>Deposit & earn</h3>
              <p>
                Supply USDG to the configured lending vault. Follow your position and available
                gains in one place.
              </p>
            </li>
            <li>
              <span className="home-step-number">03</span>
              <h3>Choose your stocks</h3>
              <p>
                Use available gains for one stock or a basket, or reinvest them. Review each
                transaction in your wallet.
              </p>
            </li>
          </ol>
        </section>
        <section className="home-demo-invitation">
          <div>
            <span className="earn-eyebrow">EXPLORE FIRST</span>
            <h2>Get a feel for it.</h2>
            <p>
              Try lending, model leveraged LPs, and see stock conversions or compounding with
              simulated money.
            </p>
          </div>
          <DemoLink className="earn-button">
            Try it yourself <ArrowRight size={18} />
          </DemoLink>
        </section>
      </div>
    </EarnShell>
  );
}
