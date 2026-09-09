"use client";
import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { ScrollMotion } from "./scroll-motion";
import { MotionEffects } from "./motion-effects";
import { DemoLink } from "./demo/demo-link";
import { HeaderWalletButton } from "./live/header-wallet-button";
export function EarnShell({
  children,
  active = "Home",
  navigationLocked = false,
  onNavigationBlocked,
}: {
  children: React.ReactNode;
  active?: string;
  navigationLocked?: boolean;
  onNavigationBlocked?: () => void;
}) {
  return (
    <div
      className="earn"
      data-page={active.toLowerCase()}
      onClickCapture={(event) => {
        if (!navigationLocked || !(event.target instanceof Element)) return;
        const link = event.target.closest<HTMLAnchorElement>("a[href]");
        if (!link || link.getAttribute("href")?.startsWith("#") || link.target === "_blank") return;
        event.preventDefault();
        event.stopPropagation();
        onNavigationBlocked?.();
      }}
    >
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
            ["Home", "/"],
            ["Dashboard", "/dashboard"],
            ["Learn", "/learn"],
            ["Docs", "/docs"],
          ].map(([name, url]) => (
            <Link href={url} key={name} aria-current={active === name ? "page" : undefined}>
              {name}
            </Link>
          ))}
          <DemoLink className="nav-demo">Try it yourself</DemoLink>
        </nav>
        <HeaderWalletButton
          navigationLocked={navigationLocked}
          onNavigationBlocked={onNavigationBlocked}
        />
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
          <DemoLink view="results" className="earn-link">
            Your demo results <ArrowRight size={16} />
          </DemoLink>
        </div>
        <div>
          <p>For non-US users. Stock provider restrictions apply.</p>
          <p className="earn-small">
            Your live account uses real funds. “Try it yourself” uses simulated money. Stock Tokens
            provide economic exposure, not ownership of underlying shares. Independent product; no
            Robinhood affiliation or endorsement.
          </p>
          <a href="https://robinhood.com/rhj/stocktokens/" target="_blank" rel="noreferrer">
            About Stock Tokens <ArrowUpRight size={14} />
          </a>
        </div>
      </footer>
    </div>
  );
}
