"use client";
import { useEffect, useRef, useState } from "react";
import { formatUnits } from "ethers";
import { ArrowUpRight, Check, RefreshCw } from "lucide-react";
import PilotWorkspace, { type PilotAvailability } from "./pilot-workspace";
import { WalletConnectButton } from "./wallet-connect-button";
import { useWalletConnection } from "./wallet-provider";
import { EarnShell } from "../earn-shell";
import { MarketDirectory } from "../market-directory";
import { CHAIN_ID, EXPLORER_URL, STOCK_TOKENS } from "../../lib/live/config";
import "./live-workspace.css";
type Snapshot = {
  address: string;
  block: number;
  blockTime: string | null;
  observedAt: string;
  usdg: string;
  eth: string;
  vaultShares: string;
  vaultAssets: string;
  stocks: { symbol: string; address: string; balance: string }[];
};
type Quote = {
  symbol: string;
  amountIn: string;
  amountOut: string;
  minimumOut: string;
  slippageBps: number;
  block: number;
  expiresAt: string;
  pool: string;
};
type Preview = {
  assets: string;
  previewShares: string;
  simulation: string;
  block: number;
  reason: string;
};
const format = (v: string, decimals = 6) => {
  const n = Number(formatUnits(v, decimals));
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals === 18 ? 6 : 4,
  }).format(n);
};
export default function LiveWorkspace({ embedded = false }: { embedded?: boolean }) {
  const wallet = useWalletConnection();
  const { owner: connected, selected, network, requestConnect, switchNetwork } = wallet;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [reading, setReading] = useState(false),
    [working, setWorking] = useState(false),
    [snapshotError, setSnapshotError] = useState(""),
    [checkError, setCheckError] = useState(""),
    [input, setInput] = useState("10"),
    [symbol, setSymbol] = useState("NVDA"),
    [quote, setQuote] = useState<Quote | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [availability, setAvailability] = useState<PilotAvailability>("loading"),
    [chainHealth, setChainHealth] = useState<{ available: boolean; message?: string } | null>(null),
    [availabilityAttempt, setAvailabilityAttempt] = useState(0),
    [snapshotAttempt, setSnapshotAttempt] = useState(0);
  const generation = useRef(0),
    requestInFlight = useRef(false);
  const busy = wallet.busy || reading || working;
  const currentSnapshot =
    network === CHAIN_ID && snapshot?.address.toLowerCase() === connected?.toLowerCase()
      ? snapshot
      : null;
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/live/status", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error("Availability check failed.");
        const value = (await response.json()) as {
          walletPilotEnabled?: unknown;
          chainHealth?: { available?: unknown; message?: unknown };
        };
        if (
          typeof value.walletPilotEnabled !== "boolean" ||
          typeof value.chainHealth?.available !== "boolean"
        )
          throw Error("Invalid availability.");
        if (!controller.signal.aborted) {
          setAvailability(value.walletPilotEnabled ? "enabled" : "unavailable");
          setChainHealth({
            available: value.chainHealth.available,
            message:
              typeof value.chainHealth.message === "string" ? value.chainHealth.message : undefined,
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAvailability("error");
          setChainHealth(null);
        }
      });
    return () => controller.abort();
  }, [availabilityAttempt]);
  useEffect(() => {
    const version = ++generation.current;
    const controller = new AbortController();
    // Discard read-only plans as soon as their wallet identity changes.
    // oxlint-disable-next-line react/react-compiler
    setQuote(null);
    setPreview(null);
    setSnapshotError("");
    setCheckError("");
    if (!connected || network !== CHAIN_ID) {
      setReading(false);
      return () => controller.abort();
    }
    setReading(true);
    void fetch(`/api/live/wallet?address=${encodeURIComponent(connected)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const value = (await response.json()) as Snapshot & { error?: string };
        if (!response.ok) throw Error(value.error ?? "Could not read this wallet.");
        if (value.address?.toLowerCase() !== connected.toLowerCase())
          throw Error("The wallet response did not match the connected account.");
        if (!controller.signal.aborted && version === generation.current) setSnapshot(value);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted && version === generation.current)
          setSnapshotError(e instanceof Error ? e.message : "Could not refresh wallet balances.");
      })
      .finally(() => {
        if (!controller.signal.aborted && version === generation.current) setReading(false);
      });
    return () => {
      controller.abort();
    };
  }, [connected, network, snapshotAttempt]);
  async function act(operation: () => Promise<void>) {
    if (requestInFlight.current || wallet.busy) return;
    requestInFlight.current = true;
    const version = generation.current;
    setWorking(true);
    setCheckError("");
    try {
      await operation();
    } catch (e) {
      if (version === generation.current)
        setCheckError(e instanceof Error ? e.message : "This check could not be completed.");
    } finally {
      requestInFlight.current = false;
      setWorking(false);
    }
  }
  async function checkQuote() {
    const id = generation.current;
    setQuote(null);
    const r = await fetch(`/api/live/quote?symbol=${symbol}&amount=${encodeURIComponent(input)}`);
    const data = (await r.json()) as Quote & { error?: string };
    if (!r.ok) throw Error(data.error ?? "No quote available.");
    if (id === generation.current) setQuote(data);
  }
  async function checkDeposit() {
    if (!connected) return;
    const id = generation.current;
    setPreview(null);
    const r = await fetch(
      `/api/live/deposit-preview?address=${connected}&amount=${encodeURIComponent(input)}`,
    );
    const data = (await r.json()) as Preview & { error?: string };
    if (!r.ok) throw Error(data.error ?? "Deposit preview unavailable.");
    if (id === generation.current) setPreview(data);
  }
  const content = (
    <div
      className={
        embedded
          ? "live-workspace dashboard-workspace"
          : "earn-wrap live-workspace dashboard-workspace"
      }
    >
      <header className="dashboard-overview">
        <div>
          <span className="earn-eyebrow">YOUR ACCOUNT</span>
          {embedded ? <h2>Your positions</h2> : <h1>Your positions</h1>}
        </div>
        {connected && (
          <button
            type="button"
            className="earn-link"
            disabled={wallet.busy}
            onClick={requestConnect}
          >
            Change wallet
          </button>
        )}
      </header>
      <div className="live-availability" data-status={availability} aria-live="polite">
        <strong>
          {availability === "loading"
            ? "Checking live account access…"
            : availability === "enabled"
              ? "Participant access confirmed"
              : availability === "unavailable"
                ? "Private participant access required"
                : "Could not check live account access"}
        </strong>
        <p>
          {availability === "enabled"
            ? "Configured for the declared Norway participant. Each transaction needs your wallet approval."
            : availability === "loading"
              ? "Wallet connection is available while access is checked."
              : "New actions require the configured participant’s signed-in account. Existing accounts can still be restored for withdrawal."}
        </p>
        {chainHealth?.available === false && (
          <output className="earn-warning">
            {chainHealth.message || "The network connection is temporarily unavailable."} Balances
            and transaction checks may be unavailable until the connection recovers.
          </output>
        )}
        {(availability === "error" ||
          availability === "unavailable" ||
          chainHealth?.available === false) && (
          <div className="live-actions">
            <button
              type="button"
              className="earn-link"
              onClick={() => {
                setAvailability("loading");
                setChainHealth(null);
                setAvailabilityAttempt((value) => value + 1);
              }}
            >
              {chainHealth?.available === false ? "Retry network connection" : "Check access again"}
            </button>
            {availability !== "enabled" && (
              <button
                type="button"
                className="earn-link"
                onClick={() =>
                  window.location.assign(
                    `/signin-with-chatgpt?return_to=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`,
                  )
                }
              >
                Sign in with the participant account
              </button>
            )}
          </div>
        )}
      </div>
      {!connected ? (
        <section className="dashboard-empty" id="wallet-connection">
          <h2>Connect to see your positions</h2>
          <p>
            Your lending account and Stock Tokens will appear here after connection. No transaction
            is requested when you connect.
          </p>
          <WalletConnectButton
            walletName="Choose an installed wallet"
            disabled={wallet.busy}
            onClick={requestConnect}
          />
        </section>
      ) : (
        <div className="dashboard-wallet-row" id="wallet-connection">
          <code>{connected}</code>
          <span>{network === CHAIN_ID ? "Robinhood Chain · 4663" : `Network ${network}`}</span>
          {network !== CHAIN_ID ? (
            <button
              type="button"
              className="earn-button"
              disabled={wallet.busy}
              onClick={() => void switchNetwork()}
            >
              Switch to Robinhood Chain
            </button>
          ) : (
            <button
              type="button"
              className="earn-link"
              disabled={busy}
              onClick={() => setSnapshotAttempt((value) => value + 1)}
            >
              <RefreshCw size={14} />
              Refresh wallet balances
            </button>
          )}
        </div>
      )}
      {wallet.error && (
        <p className="earn-warning" role="alert">
          {wallet.error}
        </p>
      )}
      {snapshotError && connected && network === CHAIN_ID && (
        <div className="earn-warning" role="alert">
          <p>{snapshotError}</p>
          <button
            type="button"
            className="earn-link"
            disabled={busy}
            onClick={() => setSnapshotAttempt((value) => value + 1)}
          >
            Retry wallet balances
          </button>
        </div>
      )}
      {currentSnapshot && (
        <p className="earn-small live-last-checked">
          Wallet balances last checked {new Date(currentSnapshot.observedAt).toLocaleString()}.
          {snapshotError ? " Showing the last successful check." : " Refresh to check again."}
        </p>
      )}
      {reading && (
        <p className="earn-small" aria-live="polite">
          Reading wallet balances…
        </p>
      )}
      {connected && selected && network === CHAIN_ID && (
        <PilotWorkspace
          key={`${selected.info.uuid}-${connected}`}
          owner={connected}
          provider={selected.provider}
          availability={availability}
        />
      )}
      <details className="live-advanced-tools">
        <summary>Wallet balances and advanced checks</summary>
        <div className="live-advanced-content">
          {currentSnapshot && (
            <section className="earn-section">
              <div className="section-title">
                <h2>Onchain balances</h2>
                <span className="earn-pill">
                  <Check size={13} /> Block {currentSnapshot.block.toLocaleString()}
                </span>
              </div>
              <div className="earn-stats">
                <div>
                  <span>Wallet USDG</span>
                  <strong>{format(currentSnapshot.usdg)}</strong>
                </div>
                <div>
                  <span>ETH for gas</span>
                  <strong>{format(currentSnapshot.eth, 18)}</strong>
                </div>
                <div>
                  <span>Vault shares</span>
                  <strong>{format(currentSnapshot.vaultShares, 18)}</strong>
                </div>
                <div>
                  <span>Preview redemption value</span>
                  <strong>
                    {format(currentSnapshot.vaultAssets)} <small>USDG</small>
                  </strong>
                </div>
              </div>
              <p className="earn-small">
                Redemption value is a contract preview, not a withdrawal guarantee. Existing vault
                value is not labeled as earned interest because its original deposit history has not
                been reconciled here.
              </p>
              <div className="holdings-grid">
                {currentSnapshot.stocks.map((s) => (
                  <article key={s.symbol}>
                    <div>
                      <h3>{s.symbol}</h3>
                      <p>{format(s.balance, 18)} tokens</p>
                      <a
                        className="earn-link"
                        href={`${EXPLORER_URL}/token/${s.address}?a=${currentSnapshot.address}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View on explorer <ArrowUpRight size={12} />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
              <p className="earn-small">
                Last checked {new Date(currentSnapshot.observedAt).toLocaleString()}. Balances
                refresh on connection or when you request it; public RPC availability can vary.
              </p>
            </section>
          )}

          <section className="earn-builder">
            <h2>Check a real route</h2>
            <p className="earn-small">
              The same amount can preview a vault deposit or a stock purchase. These checks do not
              move money.
            </p>
            <label>
              USDG amount · up to 100
              <input
                type="number"
                disabled={busy}
                value={input}
                min="0.000001"
                max="100"
                step="0.000001"
                onChange={(e) => {
                  generation.current++;
                  setInput(e.target.value);
                  setQuote(null);
                  setPreview(null);
                }}
              />
            </label>
            <label>
              Stock Token
              <select
                disabled={busy}
                value={symbol}
                onChange={(e) => {
                  generation.current++;
                  setSymbol(e.target.value);
                  setQuote(null);
                }}
              >
                {STOCK_TOKENS.map((s) => (
                  <option key={s.symbol} disabled={s.symbol === "MSFT"}>
                    {s.symbol}
                    {s.symbol === "MSFT" ? " · direct route unavailable" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="live-actions">
              <button
                type="button"
                className="earn-button"
                disabled={busy}
                onClick={() => void act(checkQuote)}
              >
                Get stock quote
              </button>
              <button
                type="button"
                className="earn-button"
                disabled={busy || !connected || network !== CHAIN_ID}
                onClick={() => void act(checkDeposit)}
              >
                Preview deposit
              </button>
            </div>
            {checkError && (
              <p className="earn-warning" role="alert">
                {checkError}
              </p>
            )}
            {quote && (
              <div className="live-result">
                <span className="earn-eyebrow">UNISWAP V3 · ONCHAIN QUOTE</span>
                <strong>
                  {format(quote.amountIn)} USDG → {format(quote.amountOut, 18)} {quote.symbol}
                </strong>
                <p>
                  Minimum at 1% slippage: {format(quote.minimumOut, 18)} tokens. Gas is additional.
                </p>
                <small>
                  Block {quote.block.toLocaleString()} · Quote expires{" "}
                  {new Date(quote.expiresAt).toLocaleTimeString()}. Not an executed trade.
                </small>
                <a
                  href={`${EXPLORER_URL}/address/${quote.pool}`}
                  target="_blank"
                  rel="noreferrer"
                  className="earn-link"
                >
                  Inspect pool <ArrowUpRight size={14} />
                </a>
              </div>
            )}
            {preview && (
              <div className="live-result">
                <strong>
                  {format(preview.assets)} USDG → {format(preview.previewShares, 18)} vault shares
                </strong>
                <p>
                  {preview.simulation === "passed"
                    ? "The exact deposit call simulated successfully at this block."
                    : preview.simulation === "needs-balance"
                      ? "The connected wallet needs more USDG before a deposit can be simulated."
                      : preview.simulation === "needs-approval"
                        ? "A token allowance is needed before the exact deposit can be simulated. No approval has been requested."
                        : "The exact deposit call could not be simulated."}
                </p>
                <small>{preview.reason}</small>
              </div>
            )}
          </section>
        </div>
      </details>
      <MarketDirectory />
    </div>
  );
  return embedded ? content : <EarnShell active="Dashboard">{content}</EarnShell>;
}
