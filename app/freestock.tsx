"use client";
/* SVG brand marks are already local and optimized. Inline chart SVG needs its image role. */
/* oxlint-disable next/no-img-element, jsx-a11y/prefer-tag-over-role, next/no-html-link-for-pages -- Local SVG images and semantic SVG roles are intentional; Sites sign-in requires native top-level navigation. */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ChartNoAxesCombined,
  CircleHelp,
  Gift,
  History,
  Layers,
  Plus,
  ShieldCheck,
  Sparkles,
  Wallet,
  ChevronRight,
  Download,
  Clock3,
  LoaderCircle,
  Check,
  Info,
  ArrowUpFromLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  initialState,
  parseAmount,
  parseCommand,
  STOCKS,
  PEERS,
  UNIT,
  DAY,
  type State,
  type Command,
  type Draw,
  type Stock,
} from "@/lib/engine";

const bigint = (value: string) => BigInt(value);
const names: Record<Stock, string> = {
  AAPL: "Apple",
  NVDA: "NVIDIA",
  MSFT: "Microsoft",
  TSLA: "Tesla",
  GOOGL: "Alphabet",
  SPY: "S&P 500",
};
const money = (value: string | bigint) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) / 1e6);
const num = (n: number, digits = 0) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);
const entries = (n: string) => Number(n) / Number(UNIT * DAY);
const eventNames: Record<string, string> = {
  deposit: "Savings added",
  withdrawal_requested: "Withdrawal requested",
  withdrawal_completed: "Withdrawal completed",
  time_advanced: "Time advanced",
  draw_closed: "Entries locked",
  randomness_stored: "Draw result stored",
  prize_settled: "Prize settled",
  prize_claimed: "Allocation claimed",
  stock_selected: "Example stock changed",
};
function SuccessIcon() {
  return (
    <svg className="success-icon" viewBox="0 0 28 28" width="23" height="23" aria-hidden="true">
      <path d="M4 14l8 7L24 7" />
    </svg>
  );
}
function ActionButton({
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "className"> & { className?: string }) {
  return (
    <Button {...props} className={`primary arrow-button ${props.className || ""}`}>
      {children}
      <span className="arrow-capsule" aria-hidden="true">
        <ArrowRight size={17} />
      </span>
    </Button>
  );
}
function StockLogo({ symbol }: { symbol: Stock }) {
  if (symbol === "SPY")
    return (
      <span className="stock-logo spy-mark" aria-hidden="true">
        <ChartNoAxesCombined size={22} />
      </span>
    );
  return <img className="stock-logo" src={`/stocks/${symbol}.svg`} alt="" width="36" height="36" />;
}
function StockTicket({ stock }: { stock: Stock }) {
  return (
    <div className="stock-ticket">
      <div className="ticket-top">
        <StockLogo symbol={stock} />
        <span>
          {stock}
          <br />
          <small>{names[stock]}</small>
        </span>
        <Sparkles size={17} />
      </div>
      <div className="ticket-value">
        $10<span>simulated allocation</span>
      </div>
      <div className="ticket-bottom">
        EXAMPLE PRIZE <Gift size={17} />
      </div>
    </div>
  );
}
function SavingsChart({ state }: { state: State }) {
  const points = state.points.slice(-60),
    max = Math.max(1, ...points.map((p) => Number(p.balance))),
    last = Math.max(1, points.length - 1);
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${(i / last) * 600} ${102 - (Number(p.balance) / max) * 77}`)
    .join(" ");
  return (
    <div className="savings-graph">
      <div className="graph-grid" />
      <svg
        viewBox="0 0 600 120"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Savings history. Current simulated balance ${money(state.balance)}.`}
      >
        <path
          d={points.length === 1 ? "M0 102 L600 102" : path}
          stroke="#918df6"
          strokeWidth="2.4"
          fill="none"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {state.events.length === 0 && <span>Your next chapter starts with your first deposit.</span>}
    </div>
  );
}
export default function Freestock() {
  const [state, setState] = useState<State>(() => initialState("2026-09-08")),
    [ready, setReady] = useState(false),
    [signedOut, setSignedOut] = useState(false),
    [busy, setBusy] = useState(false),
    [pane, setPane] = useState("overview"),
    [amount, setAmount] = useState("250"),
    [mode, setMode] = useState("deposit"),
    [modal, setModal] = useState<"funds" | "about" | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [retry, setRetry] = useState<{ command: Command; key: string } | null>(null),
    [activityFilter, setActivityFilter] = useState("all");
  const version = useRef(-1),
    running = useRef(false),
    stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const accept = useCallback((result: { state: State; version: number }) => {
    if (result.version >= version.current) {
      version.current = result.version;
      setState(result.state);
      setReady(true);
    }
  }, []);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/account", { cache: "no-store" });
      const data = (await r.json()) as { state: State; version: number; error?: string };
      if (r.status === 401) {
        setSignedOut(true);
        return;
      }
      if (!r.ok) throw Error(data.error);
      accept(data);
      setError("");
      setSignedOut(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your preview could not be loaded.");
    }
  }, [accept]);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- All load state updates follow the awaited network response.
    void load();
  }, [load]);
  const run = useCallback(
    async (command: Command, key?: string) => {
      if (running.current) return false;
      running.current = true;
      setBusy(true);
      setError("");
      setNotice("");
      const requestKey = key || crypto.randomUUID();
      let definiteFailure = false;
      try {
        const response = await fetch("/api/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey },
          body: JSON.stringify(command),
          signal: AbortSignal.timeout(20000),
        });
        const data = (await response.json()) as { state: State; version: number; error?: string };
        if (!response.ok) {
          definiteFailure = response.status < 500;
          if (response.status >= 500) setRetry({ command, key: requestKey });
          else setRetry(null);
          throw Error(data.error || "The action could not be completed.");
        }
        accept(data);
        setRetry(null);
        setModal(null);
        setNotice(
          command.type === "deposit"
            ? "Simulated funds added. Your entries will build as time advances."
            : command.type === "withdraw"
              ? "Withdrawal reserved. Complete it below to return funds to your practice wallet."
              : command.type === "advance"
                ? `${command.days} simulated day${command.days === 1 ? "" : "s"} completed.`
                : command.type === "claim"
                  ? "Your simulated allocation is in your portfolio."
                  : "Saved to your preview.",
        );
        return true;
      } catch (e) {
        if (!definiteFailure) setRetry({ command, key: requestKey });
        setModal(null);
        setError(
          e instanceof Error ? e.message : "Connection interrupted. Retry to confirm the result.",
        );
        return false;
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [accept],
  );
  const toolsRef = useRef({ ready, retry, run });
  useEffect(() => { toolsRef.current = { ready, retry, run }; }, [ready, retry, run]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: { signal: AbortSignal }) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    const register = async () => {
      try {
        await context.registerTool(
          {
            name: "get_freestock_preview",
            description: "Read simulated savings and draw state. No real funds.",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true },
            execute: () => ({ mode: "simulation", state: stateRef.current }),
          },
          { signal: lifecycle.signal },
        );
        await context.registerTool(
          {
            name: "add_simulated_freestock_funds",
            description:
              "Complete a deposit of simulated USDG into the saved private preview. Never moves real funds.",
            inputSchema: {
              type: "object",
              properties: { amount: { type: "string" } },
              required: ["amount"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false },
            execute: async (input: unknown) => {
              const c = parseCommand({ ...(input as object), type: "deposit" });
              if (!toolsRef.current.ready || toolsRef.current.retry || running.current)
                throw Error("Preview is not ready for another action.");
              const ok = await toolsRef.current.run(c);
              if (!ok) throw Error("Deposit not confirmed. Check the visible error.");
              return { mode: "simulation", confirmed: true };
            },
          },
          { signal: lifecycle.signal },
        );
      } catch {
        /* Optional browser proposal. Core product stays available. */
      }
    };
    void register();
    return () => lifecycle.abort();
  }, []);
  const locked = !ready || busy || !!retry;
  const total = PEERS.reduce((a, b) => a + b, bigint(state.balance));
  const weightTotal = state.weights.reduce((a, b) => a + bigint(b), 0n);
  const odds = weightTotal
    ? Number((bigint(state.weights[0]) * 1000000n) / weightTotal) / 10000
    : 0;
  const nextDraw = Math.floor(state.day / 7) + 1,
    daysLeft = 7 - (state.day % 7);
  const won = Object.values(state.holdings).reduce((n, x) => n + bigint(x!), 0n);
  const drawWork = state.draws.filter((d) =>
    ["closed", "randomness_ready", "claimable"].includes(d.status),
  ).length;
  let amountError = "";
  try {
    const n = parseAmount(amount);
    if (n > bigint(mode === "deposit" ? state.wallet : state.balance))
      amountError =
        mode === "deposit"
          ? "Amount exceeds your practice wallet."
          : "Amount exceeds your savings.";
  } catch {
    amountError = "Enter a valid USDG amount.";
  }
  const chooseMode = (value: string) => {
    setMode(value);
    setAmount(value === "withdraw" ? "100" : "250");
  };
  const exportActivity = () => {
    const content = JSON.stringify(
      { product: "freestock", mode: "simulation", exportedAt: new Date().toISOString(), state },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "freestock-simulated-account.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const eventList = [...state.events]
    .reverse()
    .filter(
      (e) =>
        activityFilter === "all" ||
        (activityFilter === "savings"
          ? ["deposit", "withdrawal_requested", "withdrawal_completed"].includes(e.type)
          : e.type.startsWith("prize") ||
            e.type === "draw_closed" ||
            e.type === "randomness_stored"),
    );
  function DrawAction({ draw }: { draw: Draw }) {
    const actions: Partial<
      Record<Draw["status"], { label: string; type: "resolve" | "settle_prize" | "claim" }>
    > = {
      closed: { label: "Reveal example result", type: "resolve" },
      randomness_ready: { label: "Settle example prize", type: "settle_prize" },
      claimable: { label: "Claim simulated allocation", type: "claim" },
    };
    const action = actions[draw.status];
    return action ? (
      <Button
        className="secondary"
        disabled={locked}
        onClick={() => void run({ type: action.type, drawId: draw.id })}
      >
        {action.label}
        <ArrowRight size={15} />
      </Button>
    ) : (
      <span className="pill">
        {draw.status === "unfunded"
          ? "Not funded"
          : draw.status === "claimed"
            ? "Claimed"
            : "Completed"}
        <Check size={13} />
      </span>
    );
  }
  return (
    <Tabs value={pane} onValueChange={(v) => setPane(String(v))} className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="freestock home">
          <ChartNoAxesCombined size={26} />
          freestock<span>✳</span>
        </Link>
        <TabsList className="main-nav">
          <span
            className="nav-glider"
            style={{
              transform: `translateX(${["overview", "draws", "activity"].indexOf(pane) * 100}%)`,
            }}
          />
          {[
            ["overview", "Overview"],
            ["draws", "Prize draws"],
            ["activity", "Activity"],
          ].map(([value, label]) => (
            <TabsTrigger className="nav-item" key={value} value={value}>
              {label}
              {value === "draws" && drawWork > 0 && <span className="nav-count">{drawWork}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        <button className="account-pill" onClick={() => setModal("about")}>
          <span className="avatar">f</span>Your preview
          <ChevronRight size={13} />
        </button>
      </header>
      <div className="preview-strip">
        <span>
          <Sparkles size={14} />
          Private preview. Explore with simulated USDG.
        </span>
        <span>
          No real funds connected
          <ShieldCheck size={14} />
        </span>
      </div>
      <main className="workspace" id="main-content">
        <div className="page-heading">
          <div>
            <p className="small-label">A LITTLE SAVING. A LOT OF POSSIBILITY.</p>
            <h1>
              {pane === "overview"
                ? "Make room for a little more."
                : pane === "draws"
                  ? "A little anticipation."
                  : "Every step, accounted for."}
            </h1>
            <p>
              {pane === "overview"
                ? "Your savings build entries. Pool yield powers stock prizes."
                : pane === "draws"
                  ? "Follow your entries from a saved balance to an example stock prize."
                  : "Your deposits, withdrawals, entries, and prizes in one place."}
            </p>
          </div>
          <button className="pill" onClick={() => setModal("about")}>
            <Layers size={15} />
            USDG pool
            <CircleHelp size={13} />
          </button>
        </div>
        {signedOut && (
          <div className="message-banner">
            <Info size={18} />
            <span>Sign in to start your own saved preview.</span>
            <a
              className="secondary"
              data-auth-navigation="dispatch-owned"
              href="/signin-with-chatgpt?return_to=%2F"
              target="_top"
            >
              Sign in with ChatGPT
              <ArrowRight size={14} />
            </a>
          </div>
        )}
        {error && (
          <div className="message-banner error" role="alert">
            <Info size={18} />
            <span>{error}</span>
            <Button
              className="secondary"
              disabled={busy}
              onClick={() => (retry ? void run(retry.command, retry.key) : void load())}
            >
              {busy ? "Retrying…" : "Retry"}
            </Button>
          </div>
        )}
        {notice && (
          <div className="message-banner success" role="status">
            <SuccessIcon />
            <span>{notice}</span>
            <button
              className="dismiss"
              aria-label="Dismiss confirmation"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        {!ready && !signedOut && !error && (
          <div className="loading-line" role="status">
            <LoaderCircle size={15} className="spin" />
            Loading your saved preview…
          </div>
        )}
        <TabsContent value="overview" className="pane-content">
          <div className="dashboard-grid">
            <section className="savings-panel panel">
              <div className="section-top">
                <h2>Your savings</h2>
                <Wallet size={18} />
              </div>
              <div className="balance">
                {money(state.balance).split(".")[0]}
                <span>.{money(state.balance).split(".")[1]}</span>
              </div>
              <p className="caption">Simulated USDG balance</p>
              <SavingsChart state={state} />
              <div className="savings-bottom">
                <div>
                  <span className="caption">This draw’s entries</span>
                  <strong>
                    {num(entries(state.weights[0]), 2)}
                    <span> USDG-days</span>
                  </strong>
                </div>
                <div>
                  <span className="caption">Claimed stock allocations</span>
                  <strong>{money(won)}</strong>
                </div>
              </div>
            </section>
            <section className="deposit-panel panel">
              <div className="section-top">
                <h2>{mode === "deposit" ? "Add to your savings" : "Withdraw savings"}</h2>
                {mode === "deposit" ? <ArrowDownLeft size={19} /> : <ArrowUpFromLine size={19} />}
              </div>
              <fieldset className="money-mode" aria-label="Savings action">
                <Button aria-pressed={mode === "deposit"} onClick={() => chooseMode("deposit")}>
                  Deposit
                </Button>
                <Button aria-pressed={mode === "withdraw"} onClick={() => chooseMode("withdraw")}>
                  Withdraw
                </Button>
              </fieldset>
              <label htmlFor="savings-amount" className="amount-input">
                <span>$</span>
                <Input
                  id="savings-amount"
                  aria-label={`${mode === "deposit" ? "Deposit" : "Withdrawal"} amount in USDG`}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  maxLength={16}
                />
                <span>USDG</span>
              </label>
              <div className="quick-amounts">
                {["100", "250", "500", "Max"].map((v) => (
                  <Button
                    key={v}
                    onClick={() =>
                      setAmount(
                        v === "Max"
                          ? String(Number(mode === "deposit" ? state.wallet : state.balance) / 1e6)
                          : v,
                      )
                    }
                  >
                    {v === "Max" ? "Max" : `$${v}`}
                  </Button>
                ))}
              </div>
              <div className="deposit-explainer">
                <div>
                  <Wallet size={16} />
                  <span>{mode === "deposit" ? "Practice wallet" : "Available savings"}</span>
                  <strong>{money(mode === "deposit" ? state.wallet : state.balance)}</strong>
                </div>
                <div>
                  <Gift size={16} />
                  <span>{mode === "deposit" ? "Entries start building" : "Withdrawal method"}</span>
                  <strong>{mode === "deposit" ? "After deposit" : "Request, then complete"}</strong>
                </div>
              </div>
              <ActionButton
                className="wide"
                disabled={locked || !!amountError}
                onClick={() => setModal("funds")}
              >
                {busy
                  ? "Saving…"
                  : mode === "deposit"
                    ? "Add simulated funds"
                    : "Request withdrawal"}
              </ActionButton>
              <p className="footnote">
                {amountError && amount !== ""
                  ? amountError
                  : "Preview funds have no monetary value."}
              </p>
            </section>
            <section className="prize-panel panel">
              <div className="prize-copy">
                <span className="pill">
                  <Gift size={14} />
                  Next example prize
                </span>
                <h2>
                  A little {names[state.stock]}.<br />A lot to look forward to.
                </h2>
                <p>
                  Save over time for a chance at a<br />
                  $10 simulated stock allocation.
                </p>
                <button className="text-button" onClick={() => setPane("draws")}>
                  Explore the draw
                  <ArrowUpRight size={17} />
                </button>
              </div>
              <StockTicket stock={state.stock} />
            </section>
            <section className="pool-panel panel">
              <div className="section-top">
                <h2>A shared possibility</h2>
                <Layers size={18} />
              </div>
              <p className="caption">Example pool savings</p>
              <strong className="pool-amount">{money(total)}</strong>
              <div className="pool-line">
                <span>Your savings</span>
                <span>{money(state.balance)}</span>
              </div>
              <div className="pool-line">
                <span>4 example savers</span>
                <span>$32,500.00</span>
              </div>
              <div className="pool-divider" />
              <div className="pool-line">
                <span>Uncommitted simulated yield</span>
                <span>{money(state.availableYield)}</span>
              </div>
              <p>
                Only realized yield can fund prizes.
                <br />
                Savings are never a prize budget.
              </p>
            </section>
          </div>
          {bigint(state.pending) > 0n && (
            <div className="withdrawal-banner">
              <div>
                <Clock3 size={20} />
                <p>
                  <strong>{money(state.pending)} withdrawal pending</strong>
                  <span>This amount no longer builds future entries. Existing entries remain.</span>
                </p>
              </div>
              <Button
                className="secondary"
                disabled={locked}
                onClick={() => void run({ type: "complete_withdrawal" })}
              >
                Complete simulated withdrawal
                <ArrowRight size={15} />
              </Button>
            </div>
          )}
          <section className="simulation-controls">
            <div>
              <Clock3 size={19} />
              <p>
                <strong>Try a little time travel.</strong>
                <span>
                  Day {state.day} of your preview. {daysLeft} simulated day
                  {daysLeft === 1 ? "" : "s"} until draw #{nextDraw}.
                </span>
              </p>
            </div>
            <div className="simulation-actions">
              <Button
                className="secondary"
                disabled={locked || state.day >= 365}
                onClick={() => void run({ type: "advance", days: 1 })}
              >
                +1 day
              </Button>
              <Button
                className="secondary"
                disabled={locked || state.day > 358}
                onClick={() => void run({ type: "advance", days: 7 })}
              >
                +7 days
                <ArrowRight size={15} />
              </Button>
            </div>
          </section>
          <section className="how-strip">
            <div>
              <span className="step-icon">
                <Plus size={17} />
              </span>
              <p>
                <strong>Save at your own pace.</strong>
                <span>Add simulated USDG to the pool.</span>
              </p>
            </div>
            <div>
              <span className="step-icon">
                <History size={17} />
              </span>
              <p>
                <strong>Let your entries build.</strong>
                <span>Amount and time both count.</span>
              </p>
            </div>
            <div>
              <span className="step-icon">
                <Gift size={17} />
              </span>
              <p>
                <strong>See what comes next.</strong>
                <span>Pool yield funds the prizes.</span>
              </p>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="draws" className="pane-content">
          <div className="draw-layout">
            <section className="panel draw-feature">
              <div>
                <span className="pill">Example draw #{nextDraw}</span>
                <h2>Your next possibility.</h2>
                <p>
                  A $10 simulated allocation, funded only when enough simulated yield is available.
                </p>
                <div className="draw-stats">
                  <div>
                    <span>Your current entries</span>
                    <strong>{num(entries(state.weights[0]), 2)}</strong>
                    <small>USDG-days</small>
                  </div>
                  <div>
                    <span>Current entry share</span>
                    <strong>{num(odds, 2)}%</strong>
                    <small>Changes until entries lock</small>
                  </div>
                </div>
                <Button className="secondary" onClick={() => setPane("overview")}>
                  Go to your savings
                  <ArrowRight size={15} />
                </Button>
              </div>
              <StockTicket stock={state.stock} />
            </section>
            <section className="panel stock-picker">
              <h2>Pick the example prize</h2>
              <p>Changes future draws in your preview.</p>
              <div>
                {STOCKS.map((stock) => (
                  <button
                    key={stock}
                    aria-pressed={stock === state.stock}
                    disabled={locked}
                    onClick={() => void run({ type: "select_stock", stock })}
                  >
                    <StockLogo symbol={stock} />
                    <span>
                      <strong>{names[stock]}</strong>
                      <small>{stock}</small>
                    </span>
                    {stock === state.stock ? <Check size={16} /> : <Plus size={14} />}
                  </button>
                ))}
              </div>
            </section>
          </div>
          <section className="draw-history">
            <div className="section-top">
              <h2>Draw history</h2>
              <span className="caption">
                Server-generated simulation. No Chainlink request is made.
              </span>
            </div>
            {state.draws.length === 0 ? (
              <div className="empty-state">
                <Gift size={27} />
                <h3>Something to look forward to.</h3>
                <p>Add savings and advance the preview by seven days to close your first draw.</p>
                <Button className="secondary" onClick={() => setPane("overview")}>
                  Start with your savings
                  <ArrowRight size={14} />
                </Button>
              </div>
            ) : (
              <div className="draw-list">
                {[...state.draws].reverse().map((draw) => (
                  <article className="draw-row" key={draw.id}>
                    <div className="draw-identity">
                      <StockLogo symbol={draw.stock} />
                      <div>
                        <h3>
                          Draw #{draw.id}
                          <span>{draw.stock}</span>
                        </h3>
                        <p>
                          Day {draw.day} · {money(draw.amount)} simulated allocation
                        </p>
                      </div>
                    </div>
                    <div className="draw-result">
                      <strong>
                        {draw.winner === undefined
                          ? "Entries locked"
                          : draw.winner === 0
                            ? "Your entry was selected"
                            : `Example saver ${draw.winner} selected`}
                      </strong>
                      <span>
                        {draw.status === "closed"
                          ? "Ready for simulated randomness"
                          : draw.status === "randomness_ready"
                            ? "Result saved. Settlement is a separate step."
                            : draw.status === "claimable"
                              ? "Ready for you to claim"
                              : draw.status === "unfunded"
                                ? "No prize reserved"
                                : "Allocation recorded"}
                      </span>
                    </div>
                    <DrawAction draw={draw} />
                    <details className="draw-proof">
                      <summary>View draw record</summary>
                      <p>
                        <strong>Frozen entries (USDG-days):</strong> You{" "}
                        {num(entries(draw.weights[0]), 2)}; example savers{" "}
                        {draw.weights
                          .slice(1)
                          .map((w) => num(entries(w), 2))
                          .join(", ")}
                        .
                      </p>
                      <p>
                        <strong>Snapshot SHA-256:</strong> <code>{draw.snapshot}</code>
                      </p>
                      <p>
                        <strong>Simulated random index:</strong>{" "}
                        <code>{draw.randomIndex ?? "Not requested"}</code>
                      </p>
                      <p>
                        This record is stored by the preview server. It is not an onchain proof or a
                        Chainlink VRF fulfillment.
                      </p>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="portfolio-section">
            <div className="section-top">
              <h2>Your simulated allocations</h2>
              <span className="caption">
                Dollar credits only. No shares or stock tokens are purchased.
              </span>
            </div>
            {Object.keys(state.holdings).length === 0 ? (
              <p className="portfolio-empty">Claimed prizes will appear here.</p>
            ) : (
              <div className="holding-list">
                {Object.entries(state.holdings).map(([symbol, value]) => (
                  <div key={symbol}>
                    <StockLogo symbol={symbol as Stock} />
                    <span>
                      {names[symbol as Stock]}
                      <small>{symbol}</small>
                    </span>
                    <strong>{money(value!)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </TabsContent>
        <TabsContent value="activity" className="pane-content">
          <section className="activity-section panel">
            <div className="activity-toolbar">
              <fieldset className="filter-buttons" aria-label="Filter activity">
                {["all", "savings", "prizes"].map((f) => (
                  <Button
                    key={f}
                    aria-pressed={activityFilter === f}
                    onClick={() => setActivityFilter(f)}
                  >
                    {f === "all" ? "All activity" : f === "savings" ? "Savings" : "Prizes"}
                  </Button>
                ))}
              </fieldset>
              <Button className="secondary" disabled={!ready} onClick={exportActivity}>
                <Download size={14} />
                Export account
              </Button>
            </div>
            {eventList.length === 0 ? (
              <div className="empty-state">
                <History size={27} />
                <h3>{state.events.length ? "No matching activity." : "A fresh start."}</h3>
                <p>
                  {state.events.length
                    ? "Try another filter."
                    : "Your first simulated deposit will appear here."}
                </p>
              </div>
            ) : (
              <ol className="activity-list">
                {eventList.map((e) => (
                  <li key={e.id}>
                    <span className="activity-icon">
                      {e.type === "deposit" ? (
                        <ArrowDownLeft size={17} />
                      ) : e.type.startsWith("withdrawal") ? (
                        <ArrowUpRight size={17} />
                      ) : e.type.startsWith("prize") ? (
                        <Gift size={17} />
                      ) : (
                        <Clock3 size={17} />
                      )}
                    </span>
                    <div>
                      <strong>{eventNames[e.type] || e.type}</strong>
                      <p>{e.detail}</p>
                    </div>
                    <span className="activity-amount">
                      {bigint(e.amount) > 0n ? money(e.amount) : "Saved"}
                      <small>
                        Day {e.day} · #{e.id}
                      </small>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </TabsContent>
        <footer>
          <span>
            Simulated preview. Live lending can lose principal and withdrawals depend on liquidity.
          </span>
          <button className="text-button" onClick={() => setModal("about")}>
            <CircleHelp size={15} />
            How it works
          </button>
        </footer>
      </main>
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setModal(null);
        }}
      >
        <DialogContent className="freestock-dialog">
          <DialogTitle className="modal-title">
            {modal === "funds"
              ? mode === "deposit"
                ? "A little more in savings."
                : "Request your withdrawal."
              : "A little about freestock."}
          </DialogTitle>
          <DialogDescription className="modal-description">
            {modal === "funds"
              ? "Review your simulated transaction before confirming."
              : "A savings pool where realized yield funds randomly awarded stock-token prizes."}
          </DialogDescription>
          {modal === "funds" ? (
            <>
              <div className="confirmation-amount">
                {(() => {
                  try {
                    return money(parseAmount(amount));
                  } catch {
                    return "$0.00";
                  }
                })()}
                <span>simulated USDG</span>
              </div>
              <p className="modal-copy">
                {mode === "deposit"
                  ? "Funds move from your practice wallet into savings. Entries grow with the amount you save and the time it stays in the pool."
                  : "The requested amount stops building future entries and enters a withdrawal queue. Complete it in the overview to return it to your practice wallet."}
              </p>
              <div className="modal-note">
                <ShieldCheck size={18} />
                <span>No wallet signature. No real money moves.</span>
              </div>
              <ActionButton
                className="wide"
                disabled={locked || !!amountError}
                onClick={() =>
                  void run({ type: mode === "deposit" ? "deposit" : "withdraw", amount })
                }
              >
                {busy
                  ? "Saving…"
                  : mode === "deposit"
                    ? "Confirm simulated deposit"
                    : "Confirm withdrawal request"}
              </ActionButton>
            </>
          ) : (
            <div className="about-content">
              <section>
                <h3>Save. Build entries. See what happens.</h3>
                <p>
                  Every USDG held for a simulated day earns one USDG-day of entries. Draws lock
                  every seven simulated days. Your share of all entries determines your chance.
                </p>
              </section>
              <section>
                <h3>A clear separation.</h3>
                <p>
                  You start with 10,000 practice USDG. Four example savers contribute 32,500. These
                  figures are invented scenario inputs. No real people, funds, lending, shares, or
                  stock tokens are represented.
                </p>
              </section>
              <section>
                <h3>What funds a prize?</h3>
                <p>
                  The scenario assumes 4% annual gross yield and deducts 10% of that yield as
                  example costs. These are editable code assumptions, not quoted returns or proposed
                  fees. A $10 prize is reserved only from available simulated net yield.
                </p>
              </section>
              <section>
                <h3>Built toward a live product.</h3>
                <p>
                  Real deposits and trading are disabled. Vault access tests, independent security
                  review, stock settlement, and legal eligibility must be completed before launch.
                  Live principal and withdrawal liquidity would not be guaranteed.
                </p>
                <Link href="/readiness" className="text-button">
                  See integration readiness
                  <ArrowUpRight size={14} />
                </Link>
              </section>
              <div className="design-credits">
                Interface elements adapted from{" "}
                <a href="https://uiverse.io/adamgiebl/new-bird-34" target="_blank" rel="noreferrer">
                  adamgiebl
                </a>
                ,{" "}
                <a
                  href="https://uiverse.io/Pradeepsaranbishnoi/heavy-dragonfly-92"
                  target="_blank"
                  rel="noreferrer"
                >
                  Pradeepsaranbishnoi
                </a>
                , and{" "}
                <a
                  href="https://uiverse.io/Shoh2008/perfect-mouse-3"
                  target="_blank"
                  rel="noreferrer"
                >
                  Shoh2008
                </a>{" "}
                on Uiverse.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
