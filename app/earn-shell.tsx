"use client";
import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { ScrollMotion } from "./scroll-motion";
import { MotionEffects } from "./motion-effects";
import { AvailabilityCheck } from "./availability-check";
export function EarnShell({
  children,
  active = "Earn",
}: {
  children: React.ReactNode;
  active?: string;
}) {
  return (
    <div className="earn">
      <MotionEffects />
      <ScrollMotion />
      <a className="skip-link" href="#earn-main">
        Skip to content
      </a>
      <header className="earn-header">
        <Link href="/" className="earn-wordmark">
          freestock<span>↗</span>
        </Link>
        <nav aria-label="Main navigation">
          {[
            ["Earn", "/"],
            ["Live integration", "/live"],
            ["Learn", "/learn"],
            ["Docs", "/docs"],
            ["Transparency", "/transparency"],
          ].map(([name, url]) => (
            <Link href={url} key={name} aria-current={active === name ? "page" : undefined}>
              {name}
            </Link>
          ))}
        </nav>
        <span className="earn-status">
          <i /> Practice mode
        </span>
      </header>
      <main id="earn-main">{children}</main>
      <footer className="earn-footer">
        <div>
          <Link href="/" className="earn-wordmark">
            freestock<span>↗</span>
          </Link>
          <p>
            Put your DeFi earnings toward
            <br />
            the companies you follow.
          </p>
        </div>
        <div>
          <strong>Understand before you start.</strong>
          <Link href="/learn">
            How it works <ArrowRight size={16} />
          </Link>
          <Link href="/docs">
            Product mechanics <ArrowRight size={16} />
          </Link>
          <Link href="/transparency">
            Your earnings record <ArrowRight size={16} />
          </Link>
        </div>
        <div>
          <AvailabilityCheck />
          <p className="earn-small">
            Practice funds only. Stock Tokens provide economic exposure, not ownership of underlying
            shares. Independent product; no Robinhood affiliation or endorsement.
          </p>
          <a href="https://robinhood.com/rhj/stocktokens/" target="_blank" rel="noreferrer">
            About Stock Tokens <ArrowUpRight size={14} />
          </a>
        </div>
      </footer>
    </div>
  );
}
