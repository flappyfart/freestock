"use client";
/* oxlint-disable next/no-img-element -- Local optimized WebP artwork and vector marks have explicit dimensions. */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Layers, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../components/ui/dialog";
import type { DemoView } from "./demo/demo-provider";
import { MechanicalSwitch } from "./mechanical-switch";
import {
  STOCKS,
  modeledNetApr,
  type EarnState,
  type Position,
  type Stock,
  type Allocation,
} from "../lib/earn-engine";
import type { MarketCatalogue } from "../lib/markets";
// Older saved ledger text is relabeled for display without rewriting account history.
const simulationLabel = (text: string) =>
  text.replace(/\bpractice\b/gi, (word) => (word[0] === "P" ? "Simulated" : "simulated"));
const money = (micro: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(
    micro / 1e6,
  );
const percent = (n: number | null) => (n === null ? "Unavailable" : `${(n * 100).toFixed(2)}%`);
type Preferences = {
  allocation: Allocation;
  auto: boolean;
  threshold: number;
  compoundBps: number;
};
function StockMark({ symbol, size = 24 }: { symbol: Stock; size?: number }) {
  return symbol === "SPY" ? (
    <span
      className="stock-text-mark"
      style={{ width: size, height: size }}
      aria-label="S&P 500 exposure"
    >
      S&P
    </span>
  ) : (
    <img src={`/stocks/${symbol}.svg`} alt="" width={size} height={size} />
  );
}
function PayoutPicker({ value, change }: { value: Preferences; change: (v: Preferences) => void }) {
  const [basket, setBasket] = useState(value.allocation.length > 1);
  const split = value.compoundBps > 0 && value.compoundBps < 10000;
  const total = value.allocation.reduce((n, a) => n + a.bps, 0);
  return (
    <div className="payout-picker">
      <MechanicalSwitch
        label="Auto-compound"
        description={
          value.compoundBps > 0
            ? "Reinvest available earnings in this simulated position."
            : "Send available earnings toward your stock picks."
        }
        checked={value.compoundBps > 0}
        onChange={(checked) => change({ ...value, compoundBps: checked ? 10000 : 0 })}
      />
      {value.compoundBps > 0 && (
        <MechanicalSwitch
          label="Buy stocks too"
          description="Split new earnings between compounding and stock purchases."
          checked={split}
          onChange={(checked) => change({ ...value, compoundBps: checked ? 5000 : 10000 })}
        />
      )}
      {split && (
        <label>
          Reinvest into this position (%)
          <input
            type="number"
            min="1"
            max="99"
            step="1"
            value={value.compoundBps / 100}
            onChange={(e) => change({ ...value, compoundBps: Number(e.target.value) * 100 })}
          />
          <small>{100 - value.compoundBps / 100}% goes toward your stock picks.</small>
        </label>
      )}
      {value.compoundBps < 10000 && (
        <>
          <MechanicalSwitch
            label="Stock basket"
            description={
              basket
                ? "Split each purchase across several stocks."
                : "Put each purchase into one stock."
            }
            checked={basket}
            onChange={(checked) => {
              setBasket(checked);
              change({
                ...value,
                allocation: checked
                  ? [
                      { symbol: "NVDA", bps: 3400 },
                      { symbol: "AAPL", bps: 3300 },
                      { symbol: "SPY", bps: 3300 },
                    ]
                  : [{ symbol: value.allocation[0]?.symbol ?? "NVDA", bps: 10000 }],
              });
            }}
          />
          {!basket ? (
            <label>
              Stock token
              <select
                value={value.allocation[0]?.symbol ?? "NVDA"}
                onChange={(e) =>
                  change({
                    ...value,
                    allocation: [{ symbol: e.target.value as Stock, bps: 10000 }],
                  })
                }
              >
                {STOCKS.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} · {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <fieldset className="basket-weights">
              <legend>Split each stock purchase · {total / 100}% of 100%</legend>
              {STOCKS.map((s) => (
                <label key={s.symbol}>
                  <StockMark symbol={s.symbol} size={24} />
                  <span>{s.symbol}</span>
                  <input
                    aria-label={`${s.symbol} basket percentage`}
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={(value.allocation.find((a) => a.symbol === s.symbol)?.bps ?? 0) / 100}
                    onChange={(e) => {
                      const bps = Number(e.target.value) * 100;
                      change({
                        ...value,
                        allocation: STOCKS.flatMap((stock) => {
                          const weight =
                            stock.symbol === s.symbol
                              ? bps
                              : (value.allocation.find((a) => a.symbol === stock.symbol)?.bps ?? 0);
                          return weight > 0 ? [{ symbol: stock.symbol, bps: weight }] : [];
                        }),
                      });
                    }}
                  />
                  <span>%</span>
                </label>
              ))}
            </fieldset>
          )}
          <MechanicalSwitch
            label="Auto-convert"
            description={
              value.auto
                ? "Buy your stock picks when the simulated minimum is reached."
                : "Convert earnings when you choose."
            }
            checked={value.auto}
            onChange={(checked) => change({ ...value, auto: checked })}
          />
          {value.auto && (
            <label>
              Conversion minimum (simulated USDG)
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                value={value.threshold / 1e6}
                onChange={(e) => change({ ...value, threshold: Number(e.target.value) * 1e6 })}
              />
            </label>
          )}
        </>
      )}
      <p className="earn-small">
        Rules run when you advance the simulation. Compounding reinvests in DeFi; stock purchases
        use fixed illustrative prices. No background trading.
      </p>
    </div>
  );
}
function PositionCard({
  p,
  busy,
  command,
}: {
  p: Position;
  busy: boolean;
  command: (v: Record<string, unknown>) => void;
}) {
  const [days, setDays] = useState(30),
    [shock, setShock] = useState(0),
    [editing, setEditing] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>({
    allocation: p.allocation,
    auto: p.auto,
    threshold: p.threshold,
    compoundBps: p.compoundBps,
  });
  return (
    <article className="position-card">
      <div className="earn-row">
        <span className="earn-eyebrow">
          {p.id.toUpperCase()} / {p.kind === "lend" ? "LENDING" : `${p.leverage}× LP MODEL`}
        </span>
        <span className="earn-pill">{p.closed ? "Closed" : `${p.days} simulated days`}</span>
      </div>
      <h3>{p.name}</h3>
      <div className="position-metrics">
        <div>
          <span>Position capital</span>
          <strong>
            {money(p.capital)} <small>USDG</small>
          </strong>
        </div>
        <div>
          <span>Ready to convert</span>
          <strong>
            {money(p.pending)} <small>USDG</small>
          </strong>
        </div>
      </div>
      <p className="earn-small">
        {p.compoundBps / 100}% reinvested · {100 - p.compoundBps / 100}% toward{" "}
        {p.allocation.map((a) => `${a.symbol} ${a.bps / 100}%`).join(" / ")}
        <br />
        {p.auto ? `Auto-convert at ${money(p.threshold)} USDG` : "Manual stock conversion"} ·{" "}
        {money(p.compounded)} USDG compounded
      </p>
      {p.lossCarry > 0 && (
        <p className="earn-warning">
          {money(p.lossCarry)} USDG of capital losses must be recovered before new stock purchases.
        </p>
      )}
      {!p.closed && (
        <div className="position-simulation">
          <label>
            Advance scenario
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
            </select>
          </label>
          {p.kind === "lp" && (
            <label>
              LP value change (%)
              <input
                type="number"
                min="-50"
                max="50"
                step="1"
                value={shock}
                onChange={(e) => setShock(Number(e.target.value))}
              />
            </label>
          )}
          <button
            className="earn-button"
            disabled={busy || p.capital === 0}
            onClick={() => command({ type: "advance", positionId: p.id, days, shockPct: shock })}
          >
            Simulate <ArrowRight size={15} />
          </button>
        </div>
      )}
      <div className="position-actions">
        <button
          disabled={busy || p.pending < 1e6}
          onClick={() => command({ type: "convert", positionId: p.id })}
        >
          Convert earnings
        </button>
        {!p.closed && (
          <>
            <button
              disabled={busy || p.pending <= 0 || p.capital <= 0}
              onClick={() => command({ type: "compound", positionId: p.id })}
            >
              Compound now
            </button>
            <button disabled={busy} onClick={() => command({ type: "close", positionId: p.id })}>
              Withdraw capital
            </button>
          </>
        )}
        <button
          disabled={busy}
          aria-expanded={editing}
          onClick={() => {
            setPreferences({
              allocation: p.allocation,
              auto: p.auto,
              threshold: p.threshold,
              compoundBps: p.compoundBps,
            });
            setEditing(!editing);
          }}
        >
          Edit earnings rules
        </button>
      </div>
      {editing && (
        <form
          className="position-edit"
          onSubmit={(e) => {
            e.preventDefault();
            command({ type: "configure", positionId: p.id, ...preferences });
          }}
        >
          <PayoutPicker value={preferences} change={setPreferences} />
          <button className="earn-button" disabled={busy}>
            Save rules
          </button>
          <p className="earn-small">
            Applies to future purchases. Existing stock holdings stay as they are.
          </p>
        </form>
      )}
      <details className="position-assumptions">
        <summary>Scenario assumptions</summary>
        <p>
          {p.kind === "lend"
            ? `${percent(p.apy)} seven-day historical APY held constant; observed ${new Date(p.rateAsOf).toLocaleString()}. ${p.rateSource}.`
            : `${p.feeApr}% fee APR on ${p.leverage}× exposure − ${p.borrowApr}% borrowing APR on debt − ${p.costApr}% cost APR on exposure = ${modeledNetApr(p).toFixed(2)}% modeled net APR before price changes.`}
        </p>
        <p>
          Unconverted earnings sit idle. Leverage resets to its selected level at each step without
          rebalancing costs. This model does not execute or simulate liquidations; real losses can
          occur earlier.
        </p>
      </details>
    </article>
  );
}
export default function DemoWorkspace({
  open,
  view,
  onViewChange,
  onClose,
}: {
  open: boolean;
  view: DemoView;
  onViewChange: (view: DemoView) => void;
  onClose: () => void;
}) {
  const requestInFlight = useRef(false);
  const [marketError, setMarketError] = useState("");
  const [state, setState] = useState<EarnState | null>(null),
    [market, setMarket] = useState<MarketCatalogue | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<{
    key: string;
    body: Record<string, unknown>;
  } | null>(null);
  const [kind, setKind] = useState<"lend" | "lp">("lend"),
    [amount, setAmount] = useState(1000);
  const [leverage, setLeverage] = useState(2),
    [feeApr, setFeeApr] = useState(10),
    [borrowApr, setBorrowApr] = useState(6),
    [costApr, setCostApr] = useState(1);
  const [preferences, setPreferences] = useState<Preferences>({
    allocation: [{ symbol: "NVDA", bps: 10000 }],
    auto: true,
    threshold: 5e6,
    compoundBps: 0,
  });
  const load = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    try {
      const r = await fetch("/api/earn/account");
      const v = (await r.json()) as { error?: string; state: EarnState };
      if (!r.ok) throw Error(v.error ?? "Account unavailable.");
      setState(v.state);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your account.");
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!open || pendingRequest) return;
    // oxlint-disable-next-line react/react-compiler -- account updates follow awaited network responses.
    void load();
  }, [open, load, pendingRequest]);
  useEffect(() => {
    if (!open || view !== "setup") return;
    let active = true;
    void fetch("/api/markets")
      .then(async (r) => {
        if (!r.ok)
          throw Error("Lending rates are unavailable. Try again shortly or explore the LP model.");
        return r.json() as Promise<MarketCatalogue>;
      })
      .then((value) => {
        if (active) {
          setMarket(value);
          setMarketError("");
        }
      })
      .catch((e) => {
        if (active) setMarketError(e instanceof Error ? e.message : "Market data unavailable.");
      });
    return () => {
      active = false;
    };
  }, [open, view]);
  async function command(body: Record<string, unknown>, retryKey?: string) {
    if (requestInFlight.current || (pendingRequest && !retryKey)) return;
    requestInFlight.current = true;
    const key = retryKey ?? crypto.randomUUID();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/earn/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json", "idempotency-key": key },
        body: JSON.stringify(body),
      });
      const v = (await r.json()) as { error?: string; state: EarnState; replayed?: boolean };
      if (!r.ok) {
        if (r.status >= 500 || retryKey) setPendingRequest({ key, body });
        else setPendingRequest(null);
        throw Error(v.error ?? "Action failed.");
      }
      setError("");
      setState(v.state);
      setPendingRequest(null);
      setNotice(
        v.replayed
          ? "Your saved action is confirmed. Nothing was applied twice."
          : "Demo account saved. Balances and earnings are up to date.",
      );
      if (body.type === "open") onViewChange("results");
    } catch (e) {
      if (e instanceof TypeError || e instanceof SyntaxError) setPendingRequest({ key, body });
      setError(e instanceof Error ? e.message : "Could not confirm this action.");
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }
  const locked = loading || busy || !!pendingRequest || !state;
  const capital = state?.positions.reduce((n, p) => n + p.capital, 0) ?? 0,
    earned = state?.positions.reduce((n, p) => n + p.earned, 0) ?? 0,
    ready = state?.positions.reduce((n, p) => n + p.pending, 0) ?? 0;
  const stockCost = Object.values(state?.holdings ?? {}).reduce((n, h) => n + (h?.cost ?? 0), 0);
  function exportLedger() {
    if (!state) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              mode: "simulation",
              exportedAt: new Date().toISOString(),
              ...state,
              entries: state.entries.map((entry) => ({
                ...entry,
                action: simulationLabel(entry.action),
                detail: simulationLabel(entry.detail),
              })),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "freestock-demo-ledger.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const feedback = (
    <div className="earn-feedback" aria-live="polite">
      {loading && <p>Loading your demo account…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          {pendingRequest ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void command(pendingRequest.body, pendingRequest.key)}
            >
              Retry this action
            </button>
          ) : null}
          {error.startsWith("Sign in") && pendingRequest && (
            <span>
              Sign in in a new tab, then retry this saved action here.{" "}
              <a
                className="earn-link"
                href="/signin-with-chatgpt?return_to=%2F%3Fdemo%3Dresults"
                target="_blank"
                rel="noreferrer"
              >
                Sign in again
              </a>
            </span>
          )}
          {error.startsWith("Sign in") && !pendingRequest && (
            <button
              type="button"
              className="earn-link"
              onClick={() =>
                window.location.assign(
                  `/signin-with-chatgpt?return_to=${encodeURIComponent(`/?demo=${view}`)}`,
                )
              }
            >
              Sign in to try it
            </button>
          )}
          {!state && !pendingRequest && (
            <button type="button" onClick={() => void load()}>
              Retry loading
            </button>
          )}
        </p>
      )}
      {notice && (
        <p className="earn-success">
          <Check size={15} />
          {notice}
        </p>
      )}
    </div>
  );
  const canClose = !busy && !pendingRequest;
  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        if (next) return;
        if (!canClose) {
          details.cancel();
          setError(
            pendingRequest
              ? "Retry your pending action before closing so its result can be confirmed."
              : "Your action is saving. This will only take a moment.",
          );
        } else onClose();
      }}
    >
      <DialogContent className="earn demo-modal" showCloseButton={canClose}>
        <div className="demo-modal-heading">
          <span className="earn-eyebrow">THE FREESTOCK DEMO</span>
          <DialogTitle className="demo-modal-title">Try it yourself</DialogTitle>
          <DialogDescription className="demo-modal-description">
            Explore with simulated money. Your real wallet is never affected.
          </DialogDescription>
        </div>
        <div className="demo-modal-toolbar">
          <nav aria-label="Simulation views" className="demo-tabs">
            {(
              [
                ["setup", "Create position"],
                ["results", "Your results"],
                ["activity", "Activity"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-current={view === key ? "page" : undefined}
                disabled={busy}
                onClick={() => onViewChange(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          <span className="demo-balance">
            {state ? money(state.wallet) : "…"} <small>simulated USDG available</small>
          </span>
        </div>
        <div className="demo-modal-body" key={view}>
          {feedback}
          {view === "setup" ? (
            <div className="demo-setup-layout">
              <aside className="demo-guide">
                <span className="earn-pill">No real funds</span>
                <h3>See where your earnings could go.</h3>
                <ol>
                  <li>Choose a lending or LP scenario.</li>
                  <li>Pick a stock, basket, or compound.</li>
                  <li>Advance time and explore the results.</li>
                </ol>
                <p>Start with 10,000 simulated USDG. Saved scenarios stay in this demo.</p>
                {marketError && <output className="earn-warning">{marketError}</output>}
              </aside>
              <form
                className="earn-builder"
                id="try-it-yourself"
                aria-describedby="demo-explainer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void command({
                    type: "open",
                    kind,
                    amount: Math.round(amount * 1e6),
                    ...preferences,
                    leverage,
                    feeApr,
                    borrowApr,
                    costApr,
                  });
                }}
              >
                <div className="earn-row">
                  <h2>Try it yourself</h2>
                  <span className="earn-pill">Simulated money</span>
                </div>
                <p className="earn-small" id="demo-explainer">
                  Explore with 10,000 simulated USDG. These settings and results do not affect your
                  wallet. Auto-convert and leveraged LP options here are simulations.
                </p>

                <fieldset className="earn-segment" aria-label="Position type" data-kind={kind}>
                  <button
                    type="button"
                    aria-pressed={kind === "lend"}
                    onClick={() => setKind("lend")}
                  >
                    Lending
                  </button>
                  <button type="button" aria-pressed={kind === "lp"} onClick={() => setKind("lp")}>
                    Leveraged LP model
                  </button>
                </fieldset>
                {kind === "lend" ? (
                  <div className="selected-vault">
                    <div>
                      <span className="earn-eyebrow">MORPHO · ROBINHOOD CHAIN</span>
                      <strong>Steakhouse USDG</strong>
                    </div>
                    <div>
                      <strong>{market ? percent(market.vault.apy) : "—"}</strong>
                      <small>7-day historical APY</small>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="earn-small">
                      Explore LP fees, borrowing costs and changing asset values. Assumed rates; no
                      executable pool connected.
                    </p>
                    <div className="lp-inputs">
                      {[
                        ["Leverage (×)", leverage, setLeverage, 1, 3],
                        ["LP fee APR (%)", feeApr, setFeeApr, 0, 100],
                        ["Borrow APR (%)", borrowApr, setBorrowApr, 0, 100],
                        ["Cost APR on exposure (%)", costApr, setCostApr, 0, 100],
                      ].map(([label, value, setter, min, max]) => (
                        <label key={String(label)}>
                          {String(label)}
                          <input
                            type="number"
                            step="0.1"
                            min={Number(min)}
                            max={Number(max)}
                            value={Number(value)}
                            onChange={(e) =>
                              (setter as (v: number) => void)(Number(e.target.value))
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="earn-model-return">
                      {modeledNetApr({ leverage, feeApr, borrowApr, costApr }).toFixed(2)}%{" "}
                      <small>modeled net APR before price changes</small>
                    </div>
                  </>
                )}
                <label>
                  Deposit amount (simulated USDG)
                  <input
                    className="earn-amount"
                    type="number"
                    required
                    min="10"
                    max={(state?.wallet ?? 0) / 1e6}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                  <small>Available: {state ? money(state.wallet) : "—"} simulated USDG</small>
                </label>
                <div className="earn-divider">
                  <ArrowDown size={16} />
                </div>
                <PayoutPicker value={preferences} change={setPreferences} />
                <button
                  className="earn-button earn-button-wide"
                  disabled={locked || (kind === "lend" && (!market || market.vault.apy === null))}
                >
                  {busy ? "Saving…" : "Try this position"}
                  <ArrowUpRight size={18} />
                </button>
                <button
                  type="button"
                  className="earn-link"
                  disabled={busy || !!pendingRequest}
                  onClick={() => onViewChange("results")}
                >
                  View saved results <ArrowRight size={16} />
                </button>
              </form>
            </div>
          ) : view === "results" ? (
            <>
              <div className="demo-view-heading">
                <div>
                  <h2>Your simulated portfolio</h2>
                  <p>Advance time, convert earnings, and explore your positions.</p>
                </div>
                <button type="button" className="earn-link" onClick={() => onViewChange("setup")}>
                  New position <ArrowRight size={16} />
                </button>
              </div>
              <div className="demo-results-page">
                <section className="earn-section" id="positions">
                  <div className="section-title">
                    <div>
                      <span className="earn-eyebrow">TRY IT YOURSELF</span>
                      <h2>Simulated positions</h2>
                    </div>
                    <button
                      type="button"
                      className="earn-link"
                      onClick={() => onViewChange("activity")}
                    >
                      See activity <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="earn-stats">
                    <div>
                      <span>Simulated DeFi capital</span>
                      <strong>
                        {money(capital)} <small>USDG</small>
                      </strong>
                    </div>
                    <div>
                      <span>Net modeled earnings</span>
                      <strong>
                        {money(earned)} <small>USDG</small>
                      </strong>
                    </div>
                    <div>
                      <span>Ready to convert</span>
                      <strong>
                        {money(ready)} <small>USDG</small>
                      </strong>
                    </div>
                    <div>
                      <span>Spent on stock tokens</span>
                      <strong>
                        {money(stockCost)} <small>USDG</small>
                      </strong>
                    </div>
                  </div>
                  <div className="positions-grid">
                    {state?.positions.map((p) => (
                      <PositionCard
                        key={p.id}
                        p={p}
                        busy={locked}
                        command={(v) => void command(v)}
                      />
                    ))}
                  </div>
                  {state?.positions.length === 0 && (
                    <div className="earn-empty">
                      <Layers size={24} />
                      <h3>Start your first scenario.</h3>
                      <p>
                        Choose a position and your stock picks, then advance time to explore the
                        outcome.
                      </p>
                      <button
                        type="button"
                        className="earn-link"
                        onClick={() => onViewChange("setup")}
                      >
                        Try your first position <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                </section>
                <section className="earn-section">
                  <div className="section-title">
                    <div>
                      <span className="earn-eyebrow">BUILD YOUR EXPOSURE</span>
                      <h2>Simulated stock tokens</h2>
                    </div>
                    <span className="earn-small">
                      Simulated quantities · cost, not current value
                    </span>
                  </div>
                  <div className="holdings-grid">
                    {STOCKS.filter((s) => state?.holdings[s.symbol]).map((s) => (
                      <article key={s.symbol}>
                        <StockMark symbol={s.symbol} size={40} />
                        <div>
                          <h3>{s.symbol}</h3>
                          <p>{state!.holdings[s.symbol]!.quantity.toFixed(6)} simulated tokens</p>
                          <small>{money(state!.holdings[s.symbol]!.cost)} USDG modeled cost</small>
                        </div>
                      </article>
                    ))}
                  </div>
                  {stockCost === 0 && (
                    <p className="earn-muted">
                      Your chosen tokens appear here after a simulated earnings conversion.
                    </p>
                  )}
                </section>
              </div>
            </>
          ) : (
            <>
              <div className="demo-view-heading">
                <div>
                  <h2>Your demo activity</h2>
                  <p>
                    Every deposit, modeled return and stock allocation. These are simulation
                    records.
                  </p>
                </div>
              </div>
              <div className="earn-stats">
                <div>
                  <span>Demo wallet</span>
                  <strong>{money(state?.wallet ?? 0)}</strong>
                </div>
                <div>
                  <span>Position capital</span>
                  <strong>{money(capital)}</strong>
                </div>
                <div>
                  <span>Awaiting conversion</span>
                  <strong>{money(ready)}</strong>
                </div>
                <div>
                  <span>Stock purchase cost</span>
                  <strong>{money(stockCost)}</strong>
                </div>
              </div>
              <div className="transparency-equation">
                Wallet + position capital + available earnings + stock purchase cost = 10,000
                starting USDG + net modeled earnings.
              </div>
              <p className="earn-small">
                Reconciliation uses historical purchase cost, not stock market value. Internal
                transfers and compounding do not create earnings.
              </p>
              <div className="section-title">
                <h2>Activity record</h2>
                <button className="earn-button" disabled={!state} onClick={exportLedger}>
                  Export demo ledger <ArrowUpRight size={16} />
                </button>
              </div>
              <div className="ledger">
                {state?.entries.toReversed().map((entry) => (
                  <article key={entry.id}>
                    <div className="earn-row">
                      <span className="earn-eyebrow">
                        #{entry.id} · {entry.positionId.toUpperCase()} ·{" "}
                        {new Date(entry.at).toLocaleString()}
                      </span>
                      <strong>{entry.amount === 0 ? "—" : `${money(entry.amount)} USDG`}</strong>
                    </div>
                    <h3>{simulationLabel(entry.action)}</h3>
                    <p>{simulationLabel(entry.detail)}</p>
                    {entry.purchases && (
                      <ul>
                        {entry.purchases.map((buy) => (
                          <li key={buy.symbol}>
                            {buy.symbol}: {buy.quantity.toFixed(8)} simulated tokens ·{" "}
                            {money(buy.amount)} USDG · illustrative price ${buy.price}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
              {state?.entries.length === 0 && (
                <div className="earn-empty">
                  <RefreshCw size={24} />
                  <h3>No earnings activity yet.</h3>
                  <button type="button" className="earn-link" onClick={() => onViewChange("setup")}>
                    Create a simulated position <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
