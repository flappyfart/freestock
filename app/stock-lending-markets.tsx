"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import registry from "../lib/stock-lending-registry.json";
import "./stock-lending-markets.css";

type StockMarket = {
  id: string;
  symbol: string;
  loanToken: string;
  oracle: string;
  collateral: "USDG";
  status: "live" | "unavailable";
  suppliedTokens: string | null;
  borrowedTokens: string | null;
  availableTokens: string | null;
  supplyApy: number | null;
  block: string | null;
  rateBlock: string | null;
  empty: boolean | null;
};
export type StockLendingResponse = {
  asOf: string;
  status: "live" | "partial" | "unavailable";
  executionEnabled: false;
  markets: StockMarket[];
};
const addressPattern = /^0x[\da-f]{40}$/i;
const amountPattern = /^\d{1,78}(?:\.\d{1,18})?$/;
const validAmount = (value: unknown) =>
  value === null || (typeof value === "string" && amountPattern.test(value));
const validBlock = (value: unknown) =>
  value === null || (typeof value === "string" && /^(?:\d{1,30}|0x[\da-f]{1,64})$/i.test(value));
const zeroAmount = (value: string | null) => value !== null && /^0+(?:\.0+)?$/.test(value);

export function isStockLendingResponse(value: unknown): value is StockLendingResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Partial<StockLendingResponse>;
  if (
    typeof data.asOf !== "string" ||
    !Number.isFinite(Date.parse(data.asOf)) ||
    !["live", "partial", "unavailable"].includes(data.status ?? "") ||
    data.executionEnabled !== false ||
    !Array.isArray(data.markets) ||
    data.markets.length > registry.markets.length
  )
    return false;
  const symbols = new Set<string>();
  const ids = new Set<string>();
  return data.markets.every((market) => {
    if (!market || typeof market !== "object" || Array.isArray(market)) return false;
    const stock = registry.markets.find((item) => item.symbol === market.symbol);
    if (
      !stock ||
      symbols.has(stock.symbol) ||
      typeof market.id !== "string" ||
      !/^0x[\da-f]{64}$/i.test(market.id) ||
      market.id.toLowerCase() !== stock.id.toLowerCase() ||
      ids.has(market.id.toLowerCase()) ||
      typeof market.loanToken !== "string" ||
      market.loanToken.toLowerCase() !== stock.loanToken.toLowerCase() ||
      typeof market.oracle !== "string" ||
      !addressPattern.test(market.oracle) ||
      market.oracle.toLowerCase() !== stock.oracle.toLowerCase() ||
      market.collateral !== "USDG" ||
      !["live", "unavailable"].includes(market.status) ||
      !validAmount(market.suppliedTokens) ||
      !validAmount(market.borrowedTokens) ||
      !validAmount(market.availableTokens) ||
      !(
        market.supplyApy === null ||
        (typeof market.supplyApy === "number" && Number.isFinite(market.supplyApy))
      ) ||
      !validBlock(market.block) ||
      !validBlock(market.rateBlock) ||
      !(market.empty === null || typeof market.empty === "boolean")
    )
      return false;
    symbols.add(stock.symbol);
    ids.add(market.id.toLowerCase());
    return true;
  });
}

export function formatStockTokens(value: string | null) {
  if (value === null) return "Unavailable";
  const [whole, fraction = ""] = value.split(".");
  const integer = BigInt(whole);
  if (integer >= 1000n)
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(integer);
  if (integer === 0n && !zeroAmount(value) && !/[1-9]/.test(fraction.slice(0, 6)))
    return "<0.000001";
  const tail = fraction.slice(0, 6).replace(/0+$/, "");
  return integer.toString() + (tail ? `.${tail}` : "");
}
export function stockMarketState(market: StockMarket | undefined) {
  if (!market || market.status !== "live") return "Data unavailable";
  if (market.empty === true && zeroAmount(market.borrowedTokens)) return "No borrowing yet";
  if (zeroAmount(market.borrowedTokens)) return "No borrowing";
  return "USDG collateral";
}
function rate(value: number | null) {
  if (value === null) return "Unavailable";
  if (value > 0 && value < 0.0001) return "<0.01%";
  if (value < 0 && value > -0.0001) return "> -0.01%";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
function TokenAmount({ value, symbol }: { value: string | null; symbol: string }) {
  return (
    <span title={value === null ? undefined : `${value} ${symbol} tokens`}>
      {formatStockTokens(value)}
    </span>
  );
}

/** Read-only market discovery. No wallet connection, approvals or transactions. */
export function StockLendingMarkets({ embedded = false }: { embedded?: boolean }) {
  const id = useId();
  const Heading = embedded ? "h3" : "h2";
  const [data, setData] = useState<StockLendingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [now, setNow] = useState(0);
  const refreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let active = true;
    let running = false;
    let lastAttempt = 0;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (!active || running || document.visibilityState !== "visible") return;
      running = true;
      lastAttempt = Date.now();
      setLoading(true);
      const request = new AbortController();
      controller = request;
      const timeout = window.setTimeout(() => request.abort(), 15000);
      try {
        const response = await fetch("/api/stock-lending/markets", {
          cache: "no-store",
          signal: request.signal,
        });
        if (!response.ok) throw Error("Stock lending market data unavailable");
        const result: unknown = await response.json();
        if (!isStockLendingResponse(result)) throw Error("Invalid stock lending market data");
        if (!active || request.signal.aborted) return;
        // Retain a prior response only with an explicit unavailable/stale label.
        setData((previous) => (result.status === "unavailable" && previous ? previous : result));
        setUnavailable(result.status === "unavailable");
        setFailed(false);
        setNow(Date.now());
      } catch {
        if (active && document.visibilityState === "visible") {
          setFailed(true);
          setNow(Date.now());
        }
      } finally {
        window.clearTimeout(timeout);
        if (controller === request) controller = null;
        running = false;
        if (active) setLoading(false);
      }
    };
    const visible = () => {
      if (document.visibilityState !== "visible") {
        controller?.abort();
        lastAttempt = 0;
        return;
      }
      setNow(Date.now());
      if (Date.now() - lastAttempt >= 60000) void refresh();
    };
    refreshRef.current = () => void refresh();
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      void refresh();
    }, 60000);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      refreshRef.current = null;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  const old = !!data && now - Date.parse(data.asOf) > 120000;
  const hasPrevious = !!data && data.markets.some((market) => market.status === "live");
  const stale = hasPrevious && (failed || unavailable || old);
  const complete =
    data?.markets.length === registry.markets.length &&
    data.markets.every((market) => market.status === "live");
  const partial = !!data && (data.status === "partial" || !complete);
  const status = stale
    ? "Last successful response"
    : failed || unavailable || data?.status === "unavailable"
      ? "Data unavailable"
      : !data
        ? "Loading markets"
        : partial
          ? "Partial live data"
          : "Live API data";
  const current = !!data && data.status === "live" && complete && !failed && !unavailable && !old;

  return (
    <section
      className={`stock-lending ${embedded ? "stock-lending--embedded" : "stock-lending--panel"}`}
      aria-labelledby={`${id}-heading`}
      aria-describedby={`${id}-notice`}
    >
      <div className="stock-lending-heading">
        <div>
          <Heading id={`${id}-heading`}>Stock-token lending markets</Heading>
          <p>Supply asset: Stock Tokens. Borrower collateral: USDG.</p>
        </div>
        <div className="stock-lending-controls">
          <output className="stock-lending-status" data-current={current} aria-live="polite">
            {status}
          </output>
          <button
            type="button"
            className="stock-lending-refresh"
            disabled={loading}
            onClick={() => refreshRef.current?.()}
            aria-label="Refresh stock-token lending market data"
          >
            <RefreshCw size={15} aria-hidden="true" />
            {loading ? "Updating" : failed || unavailable ? "Retry" : "Refresh"}
          </button>
        </div>
      </div>
      <p className="stock-lending-notice" id={`${id}-notice`}>
        Market data only · deposits not enabled in Freestock
        <Link href="/docs#stock-lending" className="stock-lending-review-link">
          Read the lending review <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </p>
      {(stale || failed || unavailable || partial) && (
        <output className="stock-lending-message">
          {stale
            ? "The live update is unavailable or delayed. These figures are from the last successful response and may have changed."
            : failed || unavailable
              ? "Current market data could not be loaded. Retry to check again."
              : "Some market data is unavailable. Only returned values are shown."}
        </output>
      )}
      {!data && !failed && (
        <output className="stock-lending-message">Reading the five tracked markets…</output>
      )}
      <section
        className="stock-lending-table-scroll"
        aria-label="Stock lending markets, scroll horizontally on smaller screens"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard scrolling for the overflow table.
        tabIndex={0}
        aria-busy={loading}
      >
        <table>
          <caption className="stock-lending-sr">
            Five tracked Morpho markets on Robinhood Chain. Supplied and available amounts are
            quantities of each row’s Stock Token, not dollar values.
          </caption>
          <thead>
            <tr>
              <th scope="col">Stock</th>
              <th scope="col">7-day supply APY</th>
              <th scope="col">Supplied tokens</th>
              <th scope="col">Available tokens</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {registry.markets.map((stock) => {
              const market = data?.markets.find((item) => item.symbol === stock.symbol);
              const live = market?.status === "live";
              return (
                <tr key={stock.symbol}>
                  <th scope="row">
                    <strong>{stock.symbol}</strong>
                    <small>{!data && loading ? "Reading market" : stockMarketState(market)}</small>
                  </th>
                  <td className="stock-lending-apy">{rate(live ? market.supplyApy : null)}</td>
                  <td>
                    <TokenAmount
                      value={live ? market.suppliedTokens : null}
                      symbol={stock.symbol}
                    />
                  </td>
                  <td>
                    <TokenAmount
                      value={live ? market.availableTokens : null}
                      symbol={stock.symbol}
                    />
                  </td>
                  <td>
                    {market ? (
                      <a
                        className="stock-lending-source"
                        href={`https://api.morpho.org/v0/blue/markets/4663:${market.id}/state`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View ${stock.symbol} lending market source on Morpho, opens a new tab`}
                        title={`Market block: ${market.block ?? "unavailable"}. Rate block: ${market.rateBlock ?? "unavailable"}.`}
                      >
                        Morpho <ArrowUpRight size={14} aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="stock-lending-missing">Unavailable</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <div className="stock-lending-footer">
        <p>
          Amounts are Stock Tokens, not dollar values. Available means unborrowed tokens in the
          market; it is not a guarantee of withdrawal liquidity. Historical APYs can change and
          exclude rewards.
        </p>
        <p>
          {data && (
            <>
              {stale ? "Previous response" : "Data fetched"}{" "}
              <time dateTime={data.asOf}>{new Date(data.asOf).toLocaleString()}</time>.{" "}
            </>
          )}
          Checks each minute while this tab is visible. Five tracked markets, not every lending
          market on Robinhood Chain.
        </p>
      </div>
    </section>
  );
}
export default StockLendingMarkets;
