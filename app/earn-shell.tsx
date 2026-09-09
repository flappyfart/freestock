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
          <a className="nav-social" href="https://github.com/flappyfart/freestock" target="_blank" rel="noopener noreferrer" aria-label="Freestock on GitHub (opens in a new tab)">
            GitHub <ArrowUpRight size={15} aria-hidden="true" />
          </a>
          <a className="nav-social nav-x" href="https://x.com/tryfreestock" target="_blank" rel="noopener noreferrer" aria-label="Freestock on X (opens in a new tab)">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" /></svg>
          </a>
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
          <a href="https://x.com/tryfreestock" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" /></svg>
            @tryfreestock <ArrowUpRight size={14} aria-hidden="true" />
          </a>
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
