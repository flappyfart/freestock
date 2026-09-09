"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { MarketCatalogue } from "../lib/markets";
const percent = (value: number | null) =>
  value === null ? "Unavailable" : `${(value * 100).toFixed(2)}%`;
const compact = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
export function MarketDirectory() {
  const [open, setOpen] = useState(false);
  const [market, setMarket] = useState<MarketCatalogue | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetch("/api/markets")
      .then(async (response) => {
        if (!response.ok)
          throw Error("Market data is temporarily unavailable. Close and reopen to retry.");
        return response.json() as Promise<MarketCatalogue>;
      })
      .then((value) => {
        if (active) {
          setMarket(value);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Market data unavailable.");
      });
    return () => {
      active = false;
    };
  }, [open]);
  return (
    <details className="market-directory" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Explore the lending market</summary>
      {open && (
        <>
          {!market && !error && <output>Loading lending markets…</output>}
          {error && <output>{error}</output>}
          <section className="earn-section" id="markets">
            <div className="section-title">
              <div>
                <span className="earn-eyebrow">READ-ONLY DISCOVERY</span>
                <h2>Inside the lending market.</h2>
              </div>
              <span className="earn-pill">
                {market?.status === "live" ? "Live API response" : "Saved snapshot"}
              </span>
            </div>
            <p className="earn-muted">
              One tracked vault and five listed Morpho markets. This is a verified subset, not every
              pool on Robinhood Chain. Vault assets overlap with the markets below.
            </p>
            {market && (
              <>
                <div className="catalogue-vault">
                  <div>
                    <strong>Steakhouse USDG vault</strong>
                    <span>
                      Net APY {percent(market.vault.apy)} · vault fees already reflected · rewards
                      excluded
                    </span>
                  </div>
                  <div>
                    <strong>{compact(market.vault.assets)} USDG</strong>
                    <span>{compact(market.vault.liquidity)} USDG withdrawable</span>
                  </div>
                </div>
                <div className="earn-table-scroll">
                  <table>
                    <caption>
                      Listed USDG lending markets. Collateral belongs to borrowers; USDG is the
                      asset supplied.
                    </caption>
                    <thead>
                      <tr>
                        <th>Borrower collateral</th>
                        <th>7-day supply APY</th>
                        <th>USDG supplied</th>
                        <th>Unborrowed USDG</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {market.markets.map((m) => (
                        <tr key={m.id}>
                          <td>
                            {m.collateral}
                            {m.liquidity < 10 && <small>Negligible liquidity</small>}
                          </td>
                          <td>{percent(m.apy)}</td>
                          <td>{compact(m.assets)}</td>
                          <td>{compact(m.liquidity)}</td>
                          <td>
                            <a
                              href={`https://api.morpho.org/v0/blue/markets/4663:${m.id}/state`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              API <ArrowUpRight size={13} />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="earn-small">
                  {market.note}. Fetched {new Date(market.asOf).toLocaleString()}. Cached up to 60
                  seconds; this page refreshes on reload. Directory membership last checked
                  September 8, 2026. Rates can change or turn negative.
                </p>
              </>
            )}
          </section>
        </>
      )}
    </details>
  );
}
