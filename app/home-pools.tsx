"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import type { MarketCatalogue } from "../lib/markets";
import "./home-pools.css";

const formatAmount = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
const formatRate = (value: number | null) =>
  value === null ? "Unavailable" : `${(value * 100).toFixed(2)}%`;
const amountValid = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const rateValid = (value: unknown) =>
  value === null || (typeof value === "number" && Number.isFinite(value));

function validCatalogue(value: unknown): value is MarketCatalogue {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<MarketCatalogue>;
  return (
    (data.status === "live" || data.status === "snapshot") &&
    typeof data.asOf === "string" &&
    Number.isFinite(Date.parse(data.asOf)) &&
    typeof data.note === "string" &&
    !!data.vault &&
    typeof data.vault.name === "string" &&
    typeof data.vault.id === "string" &&
    /^0x[\da-f]{40}$/i.test(data.vault.id) &&
    rateValid(data.vault.apy) &&
    amountValid(data.vault.assets) &&
    amountValid(data.vault.liquidity) &&
    Array.isArray(data.markets) &&
    data.markets.every(
      (market) =>
        !!market &&
        typeof market.id === "string" &&
        /^0x[\da-f]{64}$/i.test(market.id) &&
        typeof market.collateral === "string" &&
        rateValid(market.apy) &&
        amountValid(market.assets) &&
        amountValid(market.liquidity),
    )
  );
}

export function HomePools() {
  const [catalogue, setCatalogue] = useState<MarketCatalogue | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    void fetch("/api/markets", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error("Market request failed");
        const value: unknown = await response.json();
        if (!validCatalogue(value)) throw Error("Market data unavailable");
        if (active) {
          setCatalogue(value);
          setError(false);
          setNow(Date.now());
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [refresh]);

  useEffect(() => {
    const update = () => {
      setNow(Date.now());
      if (document.visibilityState === "visible") {
        setLoading(true);
        setRefresh((value) => value + 1);
      }
    };
    const refreshTimer = window.setInterval(update, 60000);
    const clockTimer = window.setInterval(() => setNow(Date.now()), 15000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const isOld = !!catalogue && now - Date.parse(catalogue.asOf) > 120000;
  const snapshot = catalogue?.status === "snapshot";
  const status = !catalogue
    ? error
      ? "Data unavailable"
      : "Connecting to Morpho"
    : snapshot
      ? "Saved snapshot"
      : error || isOld
        ? "Update delayed"
        : "Live API data";
  const current = !!catalogue && !snapshot && !error && !isOld;

  return (
    <section className="home-pools" aria-labelledby="home-pools-title">
      <div className="home-pools-heading">
        <div>
          <span className="home-pools-eyebrow">MARKET FEED / ROBINHOOD CHAIN</span>
          <h2 id="home-pools-title">Explore the lending pools.</h2>
          <p>USDG lending, with real market data from Morpho.</p>
        </div>
        <div className="home-pools-feed-controls">
          <output className="home-pools-status" data-current={current}>
            <i aria-hidden="true" /> {status}
          </output>
          <button
            type="button"
            className="home-pools-refresh"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setRefresh((value) => value + 1);
            }}
            aria-label="Refresh lending pool data"
          >
            <RefreshCw size={15} aria-hidden="true" />
            {loading ? "Updating" : "Refresh"}
          </button>
        </div>
      </div>

      {!catalogue && (
        <output className="home-pools-placeholder">
          {error
            ? "We couldn’t load the lending data. Use Refresh to try again."
            : "Reading the tracked vault and lending markets…"}
        </output>
      )}

      {catalogue && (
        <>
          {(snapshot || error || isOld) && (
            <output className="home-pools-delay">
              {snapshot
                ? "Showing a saved snapshot while the live feed is unavailable. These figures may have changed."
                : "The latest update is delayed. The figures below are from the last successful response."}
            </output>
          )}
          <div className="home-pools-vault">
            <div className="home-pools-vault-name">
              <span className="home-pools-vault-mark" aria-hidden="true">
                U
              </span>
              <div>
                <span className="home-pools-eyebrow">AVAILABLE IN FREESTOCK</span>
                <h3>{catalogue.vault.name}</h3>
                <span className="home-pools-subtext">Morpho · Supply USDG</span>
              </div>
            </div>
            <div className="home-pools-vault-stat">
              <span>7-day net APY</span>
              <strong className="home-pools-rate">{formatRate(catalogue.vault.apy)}</strong>
            </div>
            <div className="home-pools-vault-stat">
              <span>Vault assets</span>
              <strong>
                {formatAmount(catalogue.vault.assets)} <small>USDG</small>
              </strong>
            </div>
            <div className="home-pools-vault-stat">
              <span>Withdrawable</span>
              <strong>
                {formatAmount(catalogue.vault.liquidity)} <small>USDG</small>
              </strong>
            </div>
          </div>

          <div className="home-pools-list-heading">
            <h3>Tracked lending markets</h3>
            <span>{catalogue.markets.length} markets · Supply asset: USDG</span>
          </div>
          <div className="home-pools-columns" aria-hidden="true">
            <span>Borrower collateral</span>
            <span>7-day supply APY</span>
            <span>USDG supplied</span>
            <span>Unborrowed USDG</span>
            <span>Source</span>
          </div>
          <ul className="home-pools-list" aria-label="Tracked Morpho lending markets">
            {catalogue.markets.map((market, index) => (
              <li className="home-pools-row" key={market.id}>
                <div className="home-pools-market-name">
                  <span className="home-pools-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{market.collateral}</strong>
                    <small>Borrower collateral</small>
                  </div>
                </div>
                <div className="home-pools-metric">
                  <span>7-day supply APY</span>
                  <strong className="home-pools-rate">{formatRate(market.apy)}</strong>
                </div>
                <div className="home-pools-metric">
                  <span>USDG supplied</span>
                  <strong>{formatAmount(market.assets)}</strong>
                </div>
                <div className="home-pools-metric">
                  <span>Unborrowed USDG</span>
                  <strong>{formatAmount(market.liquidity)}</strong>
                  {market.liquidity < 10 && (
                    <small className="home-pools-thin">Negligible liquidity</small>
                  )}
                </div>
                <a
                  className="home-pools-source"
                  href={`https://api.morpho.org/v0/blue/markets/4663:${market.id}/state`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`View ${market.collateral} market source on Morpho`}
                >
                  <span>API</span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          {catalogue.markets.length === 0 && (
            <p className="home-pools-placeholder">No tracked markets were returned by the feed.</p>
          )}
          <div className="home-pools-footer">
            <div>
              <p>
                Tracked subset, not every pool on Robinhood Chain. These markets are for discovery;
                Freestock currently supports the USDG vault above. Vault assets overlap with market
                supply and should not be added together.
              </p>
              <p>
                Historical rates can change or turn negative. Rewards excluded; vault fees are
                reflected in its net APY. Data fetched{" "}
                <time dateTime={catalogue.asOf}>{new Date(catalogue.asOf).toLocaleString()}</time>.
                Refreshes each minute while this tab is visible; source responses may be cached for
                up to 60 seconds.
              </p>
            </div>
            <Link href="/dashboard" className="home-pools-dashboard">
              Open dashboard <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
