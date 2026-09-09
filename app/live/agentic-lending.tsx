"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatUnits, parseUnits } from "ethers";
import { ArrowUpRight, Check, Pause, Play, RefreshCw, ScanLine } from "lucide-react";
import { ENABLED_STOCKS } from "../../lib/live/basket";
import { readJournal } from "../../lib/live/wallet-journal";
import type { Prepared } from "../../lib/live/wallet-transaction";
import {
  defaultAgentPlan,
  agentPurchaseAmount,
  evaluateLending,
  planFingerprint,
  validateAgentPlan,
  type AgentPlan,
  type AgentQuote,
  type AgentIntent,
  type PilotReadState,
} from "../../lib/live/agentic-lending";
import "./agentic-lending.css";

type Props = {
  scope: string;
  active: boolean;
  owner: string | null;
  correctNetwork: boolean;
  readState: PilotReadState | null;
  enabled: boolean;
  onConnect: () => void;
  onPosition: () => void;
  onReview: (intent: AgentIntent) => void;
};
export function AgenticLending({
  scope,
  active,
  owner,
  correctNetwork,
  readState,
  enabled,
  onConnect,
  onPosition,
  onReview,
}: Props) {
  const [plan, setPlan] = useState<AgentPlan>(() => structuredClone(defaultAgentPlan));
  const [minimum, setMinimum] = useState("1"),
    [gas, setGas] = useState("0.00005");
  const [quote, setQuote] = useState<AgentQuote | null>(null);
  const [now, setNow] = useState(0),
    [working, setWorking] = useState(false);
  const [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [history, setHistory] = useState<{ at: string; title: string; reason: string }[]>([]);
  const request = useRef<AbortController | null>(null);
  const lastDecision = useRef("");
  const storageKey = `freestock:agentic-plan:4663:${owner?.toLowerCase() ?? "preview"}`;
  const account = correctNetwork ? (readState?.account ?? null) : null;
  let currentPlan = plan,
    formError = "";
  try {
    currentPlan = validateAgentPlan({
      ...plan,
      minimumGains:
        plan.destination === "retain" ? plan.minimumGains : parseUnits(minimum, 6).toString(),
      maximumGasWei:
        plan.destination === "retain" ? plan.maximumGasWei : parseUnits(gas, 18).toString(),
    });
  } catch {
    formError =
      "Choose stock weights totaling 100%, a positive USDG minimum up to 100, and a positive ETH gas limit up to 1.";
  }
  const fingerprint = formError
    ? JSON.stringify([plan, minimum, gas])
    : planFingerprint(currentPlan);
  const latest = useRef({
    active,
    fingerprint,
    blocked: readState?.blocked,
    account,
    paused: plan.paused,
  });
  useLayoutEffect(() => {
    latest.current = {
      active,
      fingerprint,
      blocked: readState?.blocked,
      account,
      paused: plan.paused,
    };
  }, [active, fingerprint, readState?.blocked, account, plan.paused]);
  useEffect(() => {
    const restore = () => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        const value = saved
          ? validateAgentPlan(JSON.parse(saved))
          : structuredClone(defaultAgentPlan);
        setPlan(value);
        setMinimum(formatUnits(value.minimumGains, 6));
        setGas(formatUnits(value.maximumGasWei, 18));
      } catch {
        setMessage("Saved settings could not be loaded. Review this new plan before using it.");
      }
    };
    // oxlint-disable-next-line react/react-compiler -- Restore externally persisted preferences when the wallet storage scope changes.
    restore();
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) restore();
    };
    window.addEventListener("storage", sync);
    return () => {
      request.current?.abort();
      window.removeEventListener("storage", sync);
    };
  }, [storageKey]);
  useEffect(() => {
    if (!active) return;
    // oxlint-disable-next-line react/react-compiler -- Synchronize advice expiry with the external clock when this view becomes active.
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  useEffect(() => {
    request.current?.abort();
    request.current = null;
    // oxlint-disable-next-line react/react-compiler -- Invalidate external quotes immediately when the plan or active view changes.
    setQuote(null);
    setWorking(false);
    setError("");
  }, [fingerprint, active]);
  const decision = evaluateLending({
    owner: owner ?? "",
    account,
    plan: currentPlan,
    blocked: readState?.blocked,
    readError: readState?.error,
    quote,
    now,
  });
  useEffect(() => {
    if (
      !active ||
      !account ||
      formError ||
      decision.code === "busy" ||
      decision.code === lastDecision.current
    )
      return;
    lastDecision.current = decision.code;
    setHistory((rows) =>
      [
        { at: new Date().toISOString(), title: decision.title, reason: decision.reason },
        ...rows,
      ].slice(0, 12),
    );
  }, [active, account, formError, decision.code, decision.title, decision.reason]);
  function savePlan(value = currentPlan) {
    try {
      const valid = validateAgentPlan(value);
      window.localStorage.setItem(storageKey, JSON.stringify(valid));
      setMessage("Plan saved on this browser. This grants no permission to move funds.");
      setError("");
    } catch {
      setError("The plan could not be saved. Check the settings and browser storage access.");
    }
  }
  async function checkCost() {
    if (!account || !owner || formError || !decision.canQuote || !enabled || request.current)
      return;
    const controller = new AbortController(),
      captured = fingerprint,
      observedAccount = account.account;
    try {
      if (readJournal(owner)) throw Error("Resolve the pending wallet action first.");
      request.current = controller;
      setWorking(true);
      setError("");
      setQuote(null);
      const query = new URLSearchParams({
        owner,
        deployment: account.deployment,
        action: "harvest",
        amount: formatUnits(agentPurchaseAmount(account), 6),
        allocations: JSON.stringify(currentPlan.allocations),
      });
      const response = await fetch(`/api/live/pilot/prepare?${query}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const prepared = (await response.json()) as Prepared & { error?: string };
      if (!response.ok)
        throw Error(
          prepared.error ?? "The purchase could not be estimated. No action has been taken.",
        );
      if (
        controller.signal.aborted ||
        latest.current.fingerprint !== captured ||
        !latest.current.active ||
        latest.current.paused ||
        latest.current.blocked ||
        latest.current.account?.account !== observedAccount
      )
        return;
      if (readJournal(owner))
        throw Error(
          "A wallet action started elsewhere. Resolve it before checking this plan again.",
        );
      setQuote({ prepared, fingerprint: captured });
      setNow(Date.now());
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "The cost check is unavailable.");
    } finally {
      if (request.current === controller) {
        request.current = null;
        setWorking(false);
      }
    }
  }
  function review() {
    if (!account || !owner || !quote || formError) return;
    try {
      if (readJournal(owner)) throw Error("Resolve the pending wallet action first.");
      const freshDecision = evaluateLending({
        owner,
        account,
        plan: currentPlan,
        blocked: readState?.blocked,
        readError: readState?.error,
        quote,
        now: Date.now(),
      });
      if (!freshDecision.canReview) throw Error(freshDecision.reason);
      onReview({
        id: crypto.randomUUID(),
        scope,
        owner,
        account: account.account,
        deployment: account.deployment,
        amount: quote.prepared.assets,
        allocations: currentPlan.allocations,
        expiresAt: quote.prepared.expiresAt,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh this recommendation.");
    }
  }
  return (
    <section className="agentic-workspace" aria-label="Agentic Lending recommendations">
      <div className="agentic-mode">
        <span>
          <ScanLine size={17} /> Recommendation mode
        </span>
        <p>Rule-based checks. Every transaction needs your wallet approval.</p>
      </div>
      <div className="agentic-grid">
        <form
          className="agentic-plan"
          onSubmit={(e) => {
            e.preventDefault();
            if (!formError) savePlan();
          }}
        >
          <div className="agentic-section-heading">
            <h2>Your lending plan</h2>
            <span>This browser</span>
          </div>
          <div className="agentic-source">
            <small>Earning source</small>
            <strong>Steakhouse USDG</strong>
            <span>Robinhood Chain · Single-vault plan</span>
          </div>
          <label>
            Where should gains go?
            <select
              value={plan.destination}
              onChange={(e) =>
                setPlan({
                  ...plan,
                  destination: e.target.value as AgentPlan["destination"],
                  allocations:
                    e.target.value === "retain" &&
                    plan.allocations.reduce((n, a) => n + a.weightBps, 0) !== 10000
                      ? defaultAgentPlan.allocations
                      : plan.allocations,
                })
              }
            >
              <option value="stocks">Buy my stock picks</option>
              <option value="retain">Keep gains invested</option>
            </select>
          </label>
          {plan.destination === "stocks" && (
            <>
              <fieldset className="agentic-weights">
                <legend>Stock purchase allocation</legend>
                {ENABLED_STOCKS.map((stock) => (
                  <label key={stock.symbol}>
                    <span>{stock.symbol}</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      aria-label={`${stock.symbol} allocation percent`}
                      value={
                        (plan.allocations.find((a) => a.symbol === stock.symbol)?.weightBps ?? 0) /
                        100
                      }
                      onChange={(e) => {
                        const bps = Number(e.target.value) * 100;
                        setPlan({
                          ...plan,
                          allocations: ENABLED_STOCKS.flatMap((s) => {
                            const weight =
                              s.symbol === stock.symbol
                                ? bps
                                : (plan.allocations.find((a) => a.symbol === s.symbol)?.weightBps ??
                                  0);
                            return weight > 0 ? [{ symbol: s.symbol, weightBps: weight }] : [];
                          }),
                        });
                      }}
                    />
                    <span>%</span>
                  </label>
                ))}
                <p>
                  Total {plan.allocations.reduce((n, a) => n + a.weightBps, 0) / 100}% · must equal
                  100%
                </p>
              </fieldset>
              <label>
                Minimum available gains (USDG)
                <input
                  type="number"
                  min="0.000001"
                  max="100"
                  step="0.000001"
                  required
                  value={minimum}
                  onChange={(e) => setMinimum(e.target.value)}
                />
              </label>
              <label>
                Maximum estimated network fee (ETH)
                <input
                  type="number"
                  min="0.000000000000000001"
                  max="1"
                  step="any"
                  required
                  value={gas}
                  onChange={(e) => setGas(e.target.value)}
                />
              </label>
              <p className="agentic-note">
                This limits the ETH gas estimate used for advice. Pool fees are included in stock
                quotes. An all-in cost percentage in USDG is not calculated.
              </p>
            </>
          )}
          {plan.destination === "retain" && (
            <p className="agentic-note">
              Vault shares already accumulate returns. This plan recommends holding them; it does
              not raise your principal baseline or create another source of yield.
            </p>
          )}
          {formError && (
            <p className="agentic-error" role="alert">
              {formError}
            </p>
          )}
          <button className="dashboard-button" disabled={!!formError} type="submit">
            <Check size={16} /> Save plan
          </button>
          <button
            className="agentic-pause"
            type="button"
            disabled={!!formError}
            onClick={() => {
              const changed = { ...currentPlan, paused: !plan.paused };
              setPlan(changed);
              savePlan(changed);
            }}
          >
            {plan.paused ? <Play size={15} /> : <Pause size={15} />}
            {plan.paused ? "Resume recommendations" : "Pause recommendations"}
          </button>
          {message && <output className="agentic-note">{message}</output>}
        </form>
        <div className="agentic-observation">
          <div
            className="agentic-decision"
            aria-live="polite"
            data-ready={!formError && decision.canReview}
          >
            <span className="agentic-decision-label">
              <ScanLine size={18} /> Next move
            </span>
            <h2>
              {!owner
                ? "Connect your lending wallet"
                : !correctNetwork
                  ? "Use Robinhood Chain"
                  : formError
                    ? "Complete your lending plan"
                    : decision.title}
            </h2>
            <p>
              {!owner
                ? "Set your plan here, then connect to check it against your actual position."
                : !correctNetwork
                  ? "Open Your position to switch to Robinhood Chain and load your account."
                  : formError
                    ? "Set valid amounts and a stock allocation totaling 100%."
                    : decision.reason}
            </p>
            <div className="agentic-decision-actions">
              {!owner ? (
                <button className="dashboard-button" onClick={onConnect}>
                  Connect wallet <ArrowUpRight size={16} />
                </button>
              ) : !correctNetwork ||
                !account ||
                ["setup", "stale", "busy"].includes(decision.code) ? (
                <button className="dashboard-button" onClick={onPosition}>
                  Open your position <ArrowUpRight size={16} />
                </button>
              ) : decision.canQuote && !formError ? (
                <button
                  className="dashboard-button"
                  onClick={() => void checkCost()}
                  disabled={working || !enabled}
                >
                  {working ? "Checking quote and gas…" : "Check quote & gas"}
                  <RefreshCw size={16} />
                </button>
              ) : decision.canReview && !formError ? (
                <button className="dashboard-button" onClick={review} disabled={!enabled}>
                  Review purchase <ArrowUpRight size={16} />
                </button>
              ) : null}
              {quote && !decision.canReview && !decision.canQuote && (
                <button
                  className="agentic-text-button"
                  onClick={() => {
                    setQuote(null);
                    setError("");
                  }}
                >
                  Check again
                </button>
              )}
            </div>
            {!!owner && !enabled && (
              <p className="agentic-note">
                Live transaction estimates and purchases remain limited to the enabled private-pilot
                participant. Purchase checks are capped at 100 USDG per action.
              </p>
            )}
            {error && (
              <p className="agentic-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="agentic-evidence">
            <h3>What the recommendation uses</h3>
            <dl>
              <div>
                <dt>Position value</dt>
                <dd>
                  {account ? `${formatUnits(account.assetValue, 6)} USDG` : "Awaiting position"}
                </dd>
              </div>
              <div>
                <dt>Principal baseline</dt>
                <dd>{account ? `${formatUnits(account.principal, 6)} USDG` : "—"}</dd>
              </div>
              <div>
                <dt>Available after rounding reserve</dt>
                <dd>
                  {account ? `${formatUnits(account.spendableWithRoundingBuffer, 6)} USDG` : "—"}
                </dd>
              </div>
              <div>
                <dt>Network-fee estimate</dt>
                <dd>
                  {quote
                    ? `${formatUnits(quote.prepared.estimatedGasCostWei, 18)} ETH`
                    : "Needs a fresh quote"}
                </dd>
              </div>
            </dl>
            {quote?.prepared.purchases?.map((p) => (
              <div className="agentic-quote" key={p.symbol}>
                <strong>{p.symbol}</strong>
                <span>
                  {formatUnits(p.amountIn, 6)} USDG → estimated {formatUnits(p.amountOut, 18)}{" "}
                  tokens
                </span>
                <small>
                  Minimum {formatUnits(p.minimumOut, 18)} · {p.fee / 10000}% pool fee included
                </small>
              </div>
            ))}
            <p className="agentic-note">
              Surplus can include direct transfers. It is not a total of interest earned or a
              guarantee of capital.{" "}
              {account && (
                <>
                  Block {account.block.toLocaleString()} · checked{" "}
                  <time dateTime={account.observedAt}>
                    {new Date(account.observedAt).toLocaleTimeString()}
                  </time>
                  .
                </>
              )}
            </p>
          </div>
        </div>
      </div>
      <section className="agentic-history">
        <div className="agentic-section-heading">
          <h2>Decision activity</h2>
          <span>This session · no trades submitted here</span>
        </div>
        {history.length ? (
          <ol>
            {history.map((item, i) => (
              <li key={`${item.at}-${i}`}>
                <time dateTime={item.at}>{new Date(item.at).toLocaleTimeString()}</time>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p>Changes in your position’s recommendation will appear here after it is connected.</p>
        )}
        <p className="agentic-note">
          Position balances refresh while the dashboard is open and idle. Quotes are checked when
          you request them. Recommendations run while this view is open; closing it runs no
          background jobs. <Link href="/docs#agentic-lending">How Agentic Lending works ↗</Link>
        </p>
      </section>
    </section>
  );
}
