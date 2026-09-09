"use client";
import { useEffect, useRef, useState } from "react";
import { formatUnits } from "ethers";
import { ArrowUpRight, Check, RefreshCw, Wallet } from "lucide-react";
import PilotWorkspace, { type PilotAvailability } from "./pilot-workspace";
import "./live-workspace.css";
import { WalletConnectButton } from "./wallet-connect-button";
import { EarnShell } from "../earn-shell";
import { CHAIN_ID, RPC_URL, EXPLORER_URL, STOCK_TOKENS } from "../../lib/live/config";
type Provider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (event: string, cb: (v: unknown) => void) => void;
  removeListener?: (event: string, cb: (v: unknown) => void) => void;
};
type Discovered = {
  info: { uuid: string; name: string; rdns: string };
  provider: Provider;
};
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
  const [providers, setProviders] = useState<Discovered[]>([]),
    [selected, setSelected] = useState<Discovered | null>(null),
    [connected, setConnected] = useState<string | null>(null),
    [network, setNetwork] = useState<number | null>(null),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [input, setInput] = useState("10"),
    [symbol, setSymbol] = useState("NVDA"),
    [quote, setQuote] = useState<Quote | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [availability, setAvailability] = useState<PilotAvailability>("loading"),
    [availabilityAttempt, setAvailabilityAttempt] = useState(0);
  const generation = useRef(0);
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
        };
        if (typeof value.walletPilotEnabled !== "boolean") throw Error("Invalid availability.");
        if (!controller.signal.aborted)
          setAvailability(value.walletPilotEnabled ? "enabled" : "unavailable");
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailability("error");
      });
    return () => controller.abort();
  }, [availabilityAttempt]);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<Discovered>).detail;
      if (!detail?.provider?.request || !detail.info?.uuid) return;
      setProviders((all) =>
        all.some((p) => p.info.uuid === detail.info.uuid) ? all : [...all, detail],
      );
    };
    window.addEventListener("eip6963:announceProvider", listener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const fallback = (window as Window & { ethereum?: Provider }).ethereum;
    // Wallet discovery synchronizes an external browser provider once on mount.
    if (fallback)
      // oxlint-disable-next-line react/react-compiler
      setProviders((all) =>
        all.length
          ? all
          : [
              {
                info: {
                  uuid: "injected",
                  name: "Browser wallet",
                  rdns: "injected",
                },
                provider: fallback,
              },
            ],
      );
    return () => window.removeEventListener("eip6963:announceProvider", listener);
  }, []);
  useEffect(() => {
    if (!selected) return;
    const reset = () => {
      generation.current++;
      setConnected(null);
      setNetwork(null);
      setSnapshot(null);
      setQuote(null);
      setPreview(null);
      setError("Wallet or network changed. Reconnect to refresh the exact account.");
    };
    selected.provider.on?.("accountsChanged", reset);
    selected.provider.on?.("chainChanged", reset);
    return () => {
      selected.provider.removeListener?.("accountsChanged", reset);
      selected.provider.removeListener?.("chainChanged", reset);
    };
  }, [selected]);
  async function readWallet(provider: Provider, requestAccounts = false) {
    if (requestAccounts) await provider.request({ method: "eth_requestAccounts" });
    const id = ++generation.current;
    const accounts = await provider.request({
      method: "eth_accounts",
    });
    const chain = await provider.request({ method: "eth_chainId" });
    if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || typeof chain !== "string")
      throw Error("The wallet did not return a usable account.");
    const owner = accounts[0],
      chainId = Number(BigInt(chain));
    if (id !== generation.current) return;
    setConnected(owner);
    setNetwork(chainId);
    setSnapshot(null);
    setPreview(null);
    setQuote(null);
    if (chainId !== CHAIN_ID) return;
    const r = await fetch(`/api/live/wallet?address=${encodeURIComponent(owner)}`);
    const data = (await r.json()) as Snapshot & { error?: string };
    if (!r.ok) throw Error(data.error ?? "Could not read this wallet.");
    if (id === generation.current) setSnapshot(data);
  }
  async function act(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The wallet request was not completed.");
    } finally {
      setBusy(false);
    }
  }
  async function switchNetwork() {
    if (!selected) return;
    try {
      await selected.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1237" }],
      });
    } catch (e) {
      if ((e as { code?: number }).code !== 4902) throw e;
      await selected.provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x1237",
            chainName: "Robinhood Chain",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: [EXPLORER_URL],
          },
        ],
      });
    }
    await readWallet(selected.provider);
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
      className={embedded ? "live-workspace live-workspace-embedded" : "earn-wrap live-workspace"}
    >
      <section className={embedded ? "live-embedded-title" : "education-title"}>
        <span className="earn-eyebrow">REAL FUNDS · ROBINHOOD CHAIN</span>
        {embedded ? <h2>Your live account</h2> : <h1>Your live account</h1>}
        <p>
          Deposit USDG into lending, then use available gains to buy Stock Tokens for your wallet.
          You review and approve every transaction.
        </p>
      </section>
      <div className="live-availability" data-status={availability} aria-live="polite">
        <strong>
          {availability === "loading"
            ? "Checking private account access…"
            : availability === "enabled"
              ? "Live actions available for your signed-in account"
              : availability === "unavailable"
                ? "Private participant access required"
                : "Could not check live account access"}
        </strong>
        <p>
          {availability === "loading"
            ? "You can connect your wallet while availability is checked."
            : availability === "enabled"
              ? "Access is configured for the declared Norway participant. This does not verify identity or issuer eligibility."
              : availability === "unavailable"
                ? "New deposits and stock purchases are limited to the configured participant’s signed-in account. Connecting a wallet alone does not grant access."
                : "New actions wait for a successful availability check. Existing account recovery remains available."}
        </p>
        {availability !== "loading" && availability !== "enabled" && (
          <div className="live-actions">
            <button
              type="button"
              className="earn-link"
              onClick={() => {
                setAvailability("loading");
                setAvailabilityAttempt((value) => value + 1);
              }}
            >
              Check access again
            </button>
            <button
              type="button"
              className="earn-link"
              onClick={() => {
                const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                window.location.assign(
                  `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`,
                );
              }}
            >
              Sign in with the participant account
            </button>
          </div>
        )}
      </div>
      <div className="live-connection-first">
        <section className="earn-builder wallet-connection-panel">
          <div className="earn-row">
            <h2>Connect your wallet</h2>
            <Wallet size={20} />
          </div>
          <p className="earn-small">
            Connection shares your public address. It does not approve tokens, send funds or request
            a transaction signature.
          </p>
          {providers.length === 0 ? (
            <p>
              Open this page in a browser with an Ethereum wallet installed. You can keep using the
              demo account in this browser.
            </p>
          ) : (
            providers.map((p) => (
              <WalletConnectButton
                key={p.info.uuid}
                walletName={p.info.name}
                reconnect={selected?.info.uuid === p.info.uuid && !!connected}
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    setSelected(p);
                    await readWallet(p.provider, true);
                  })
                }
              />
            ))
          )}
          {connected && (
            <>
              <code className="wallet-address">{connected}</code>
              <span className="earn-pill">
                {network === CHAIN_ID ? "Robinhood Chain · 4663" : `Network ${network}`}
              </span>
              {network !== CHAIN_ID ? (
                <button
                  className="earn-button"
                  disabled={busy}
                  onClick={() => void act(switchNetwork)}
                >
                  Switch to Robinhood Chain
                </button>
              ) : (
                <button
                  className="earn-link"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      if (selected) await readWallet(selected.provider);
                    })
                  }
                >
                  <RefreshCw size={14} />
                  Refresh balances
                </button>
              )}
            </>
          )}
          <div aria-live="polite">
            {busy && <p>Checking wallet and contract data…</p>}
            {error && (
              <p role="alert" className="earn-warning">
                {error}
                {error.startsWith("Sign in") && (
                  <button
                    className="earn-link"
                    onClick={() => window.location.assign("/signin-with-chatgpt?return_to=%2Flive")}
                  >
                    Sign in
                  </button>
                )}
              </p>
            )}
          </div>
        </section>
      </div>
      {connected && selected && network === CHAIN_ID ? (
        <PilotWorkspace
          key={`${selected.info.uuid}-${connected}`}
          owner={connected}
          provider={selected.provider}
          availability={availability}
        />
      ) : (
        <section className="earn-section">
          <h3>Connect to create or restore your account</h3>
          <p>
            The private participant account supports USDG lending and purchases of five Stock Tokens
            using available gains. Deposits are limited to 100 USDG principal. Every transaction
            needs your wallet approval; stock purchases are not automatic.
          </p>
        </section>
      )}
      {snapshot && (
        <section className="earn-section">
          <div className="section-title">
            <h2>Onchain balances</h2>
            <span className="earn-pill">
              <Check size={13} /> Block {snapshot.block.toLocaleString()}
            </span>
          </div>
          <div className="earn-stats">
            <div>
              <span>Wallet USDG</span>
              <strong>{format(snapshot.usdg)}</strong>
            </div>
            <div>
              <span>ETH for gas</span>
              <strong>{format(snapshot.eth, 18)}</strong>
            </div>
            <div>
              <span>Vault shares</span>
              <strong>{format(snapshot.vaultShares, 18)}</strong>
            </div>
            <div>
              <span>Preview redemption value</span>
              <strong>
                {format(snapshot.vaultAssets)} <small>USDG</small>
              </strong>
            </div>
          </div>
          <p className="earn-small">
            Redemption value is a contract preview, not a withdrawal guarantee. Existing vault value
            is not labeled as earned interest because its original deposit history has not been
            reconciled here.
          </p>
          <div className="holdings-grid">
            {snapshot.stocks.map((s) => (
              <article key={s.symbol}>
                <div>
                  <h3>{s.symbol}</h3>
                  <p>{format(s.balance, 18)} tokens</p>
                  <a
                    className="earn-link"
                    href={`${EXPLORER_URL}/token/${s.address}?a=${snapshot.address}`}
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
            Observed {new Date(snapshot.observedAt).toLocaleString()}. Balances refresh only when
            you request it; public RPC availability can vary.
          </p>
        </section>
      )}
      <details className="live-advanced-tools">
        <summary>Advanced read-only checks</summary>
        <div className="live-advanced-content">
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
              <button className="earn-button" disabled={busy} onClick={() => void act(checkQuote)}>
                Get stock quote
              </button>
              <button
                className="earn-button"
                disabled={busy || !connected || network !== CHAIN_ID}
                onClick={() => void act(checkDeposit)}
              >
                Preview deposit
              </button>
            </div>
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
    </div>
  );
  return embedded ? content : <EarnShell active="Wallet">{content}</EarnShell>;
}
