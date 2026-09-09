'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { formatUnits, parseUnits } from 'ethers';
import {
  ArrowUpRight,
  Check,
  Pause,
  Play,
  RefreshCw,
  ScanLine,
} from 'lucide-react';
import { ENABLED_STOCKS } from '../../lib/live/basket';
import { readJournal } from '../../lib/live/wallet-journal';
import {
  defaultAgentSettings,
  validateAgentSettings,
  type AgentSettings,
} from '../../lib/live/agent-settings';
import {
  evaluateLending,
  validateAgentPlan,
  type AgentQuote,
  type AgentIntent,
  type PilotReadState,
} from '../../lib/live/agentic-lending';
import type { SavedAgentPlan, SavedDecision } from '../../lib/live/agent-store';
import './agentic-lending.css';
type History = {
  id: string;
  source: string;
  createdAt: number;
  decision: SavedDecision;
}[];
type Payload = {
  saved: SavedAgentPlan | null;
  history: History;
  quote?: AgentQuote | null;
  error?: string;
  busy?: boolean;
};
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
const time = (value: number | string | null) =>
  value
    ? new Date(
        typeof value === 'number' ? value * 1000 : value,
      ).toLocaleString()
    : 'Not checked yet';
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
  const account = correctNetwork ? (readState?.account ?? null) : null;
  const key = `${owner}:${account?.account ?? ''}`;
  const [settings, setSettings] = useState<AgentSettings>(() =>
    structuredClone(defaultAgentSettings),
  );
  const [minimum, setMinimum] = useState('1'),
    [maximum, setMaximum] = useState('25'),
    [gas, setGas] = useState('0.00005'),
    [cost, setCost] = useState('5');
  const [saved, setSaved] = useState<SavedAgentPlan | null>(null),
    [history, setHistory] = useState<History>([]),
    [quote, setQuote] = useState<AgentQuote | null>(null);
  const [loaded, setLoaded] = useState(false),
    [working, setWorking] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [health, setHealth] = useState('loading'),
    [now, setNow] = useState(0);
  const currentKey = useRef(key),
    request = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    currentKey.current = key;
  }, [key]);
  let valid = settings,
    formError = '';
  try {
    valid = validateAgentSettings({
      ...settings,
      maximumPurchase: parseUnits(maximum, 6).toString(),
      maximumCostBps: Number(cost) * 100,
      plan: {
        ...settings.plan,
        minimumGains: parseUnits(minimum, 6).toString(),
        maximumGasWei: parseUnits(gas, 18).toString(),
      },
    });
  } catch (e) {
    formError =
      e instanceof Error ? e.message : 'Check your amounts and stock weights.';
  }
  const fingerprint = JSON.stringify(valid),
    dirty =
      !!formError || !saved || fingerprint !== JSON.stringify(saved.settings);
  function fill(value: AgentSettings) {
    setSettings(value);
    setMinimum(formatUnits(value.plan.minimumGains, 6));
    setMaximum(formatUnits(value.maximumPurchase, 6));
    setGas(formatUnits(value.plan.maximumGasWei, 18));
    setCost(String(value.maximumCostBps / 100));
  }
  async function loadPlan(signal?: AbortSignal) {
    if (!owner || !account) return;
    const captured = key;
    const response = await fetch(
      `/api/live/agent?${new URLSearchParams({ owner, account: account.account })}`,
      { cache: 'no-store', signal },
    );
    const data = (await response.json()) as Payload;
    if (!response.ok)
      throw Error(data.error ?? 'Your saved plan could not load.');
    if (currentKey.current !== captured || signal?.aborted) return;
    setSaved(data.saved);
    setHistory(data.history);
    fill(data.saved?.settings ?? structuredClone(defaultAgentSettings));
    setLoaded(true);
    setQuote(null);
    setError('');
  }
  useEffect(() => {
    const controller = new AbortController();
    // oxlint-disable-next-line react/react-compiler -- Restore an authenticated external profile when its wallet/account identity changes.
    setLoaded(false);
    setWorking(false);
    setSaved(null);
    setHistory([]);
    setQuote(null);
    setMessage('');
    setError('');
    fill(structuredClone(defaultAgentSettings));
    if (owner && account && enabled)
      void loadPlan(controller.signal).catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      request.current?.abort();
      request.current = null;
    };
    // The position snapshot refreshes frequently; profile restoration follows identity only.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  useEffect(() => {
    if (!active) return;
    // oxlint-disable-next-line react/react-compiler -- Quote expiry follows the wall clock while this view is visible.
    setNow(Date.now());
    const refresh = () =>
      void fetch('/api/live/agent/health', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => setHealth((d as { status: string }).status))
        .catch(() => setHealth('unavailable'));
    refresh();
    const clock = window.setInterval(() => setNow(Date.now()), 1000),
      status = window.setInterval(refresh, 60000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(status);
    };
  }, [active]);
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- Any edited setting invalidates an external transaction quote.
    setQuote(null);
  }, [fingerprint, active]);
  const localDecision = evaluateLending({
    owner: owner ?? '',
    account,
    plan: valid.plan,
    blocked: readState?.blocked,
    readError: readState?.error,
    quote,
    now,
  });
  const recorded = !dirty ? saved?.lastDecision : null;
  const usableQuote =
    !dirty &&
    quote &&
    recorded?.cost &&
    Date.parse(recorded.cost.expiresAt) > now &&
    localDecision.canReview;
  const decision = recorded ?? localDecision;
  async function action(kind: 'save' | 'check', input = valid) {
    if (!owner || !account || !enabled || request.current) return;
    if (kind === 'check' && (dirty || !saved)) {
      setError('Save your changes before checking the plan.');
      return;
    }
    const controller = new AbortController(),
      captured = key;
    request.current = controller;
    setWorking(true);
    setError('');
    setMessage('');
    setQuote(null);
    try {
      if (kind === 'check' && readJournal(owner))
        throw Error('Finish the pending wallet action first.');
      const response = await fetch('/api/live/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          action: kind,
          owner,
          account: account.account,
          deployment: account.deployment,
          revision: saved?.revision ?? 0,
          ...(kind === 'save' ? { settings: input } : {}),
        }),
      });
      const data = (await response.json()) as Payload;
      if (!response.ok)
        throw Error(
          data.error ??
            (data.busy
              ? 'A check is already running or just finished. Wait 30 seconds and reload the plan.'
              : 'The plan changed during this check. Reload it and try again.'),
        );
      if (currentKey.current !== captured || controller.signal.aborted) return;
      setSaved(data.saved);
      setHistory(data.history);
      setQuote(data.quote ?? null);
      setNow(Date.now());
      if (kind === 'save') {
        fill(input);
        setMessage(
          'Saved to your wallet profile. No spending permission granted.',
        );
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Try again.');
    } finally {
      if (request.current === controller) {
        request.current = null;
        setWorking(false);
      }
    }
  }
  function review() {
    if (!owner || !account || !quote || !usableQuote || readState?.blocked)
      return;
    try {
      if (readJournal(owner))
        throw Error('Finish the pending wallet action first.');
      if (!recorded?.cost || Date.parse(recorded.cost.expiresAt) <= Date.now())
        throw Error('Refresh the cost estimate first.');
      const fresh = evaluateLending({
        owner,
        account,
        plan: valid.plan,
        quote,
        now: Date.now(),
        blocked: readState?.blocked,
        readError: readState?.error,
      });
      if (!fresh.canReview) throw Error(fresh.reason);
      onReview({
        id: crypto.randomUUID(),
        scope,
        owner,
        account: account.account,
        deployment: account.deployment,
        amount: quote.prepared.assets,
        allocations: valid.plan.allocations,
        expiresAt: quote.prepared.expiresAt,
        planRevision: saved!.revision,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check your plan again.');
    }
  }
  function importBrowserPlan() {
    try {
      const old = window.localStorage.getItem(
        `freestock:agentic-plan:4663:${owner?.toLowerCase()}`,
      );
      if (!old) throw Error('No earlier plan was found on this browser.');
      const plan = validateAgentPlan(JSON.parse(old));
      const maximumPurchase =
        BigInt(plan.minimumGains) > BigInt(defaultAgentSettings.maximumPurchase)
          ? plan.minimumGains
          : defaultAgentSettings.maximumPurchase;
      fill(
        validateAgentSettings({
          ...structuredClone(defaultAgentSettings),
          plan,
          maximumPurchase,
        }),
      );
      setMessage(
        'Your earlier browser settings are loaded. Save them to your wallet profile to keep them across devices.',
      );
      setError('');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'The earlier plan could not be loaded.',
      );
    }
  }
  const canManage = !!owner && !!account && enabled && loaded;
  return (
    <section className="agentic-workspace" aria-label="Agentic Lending">
      <div className="agentic-mode">
        <span>
          <ScanLine size={17} /> Agentic Lending
        </span>
        <p>Set the rules. Track the decisions. Approve each transaction.</p>
      </div>
      <div className="agentic-grid">
        <form
          className="agentic-plan"
          onSubmit={(e) => {
            e.preventDefault();
            if (!formError) void action('save');
          }}
        >
          <div className="agentic-section-heading">
            <h2>Your lending plan</h2>
            <span>
              {saved
                ? dirty
                  ? 'Unsaved changes'
                  : 'Saved to wallet profile'
                : 'Create a plan'}
            </span>
          </div>
          <div className="agentic-source">
            <small>Earning source</small>
            <strong>Steakhouse USDG</strong>
            <span>Robinhood Chain · One verified lending vault</span>
          </div>
          <label>
            Where should gains go?
            <select
              disabled={working}
              value={settings.plan.destination}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  plan: {
                    ...settings.plan,
                    destination: e.target.value as 'stocks' | 'retain',
                  },
                })
              }
            >
              <option value="stocks">Buy my stock picks</option>
              <option value="retain">Keep gains invested</option>
            </select>
          </label>
          {settings.plan.destination === 'stocks' && (
            <>
              <fieldset className="agentic-weights" disabled={working}>
                <legend>Stock allocation</legend>
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
                        (settings.plan.allocations.find(
                          (a) => a.symbol === stock.symbol,
                        )?.weightBps ?? 0) / 100
                      }
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          plan: {
                            ...settings.plan,
                            allocations: ENABLED_STOCKS.flatMap((s) => {
                              const weight =
                                s.symbol === stock.symbol
                                  ? Number(e.target.value) * 100
                                  : (settings.plan.allocations.find(
                                      (a) => a.symbol === s.symbol,
                                    )?.weightBps ?? 0);
                              return weight > 0
                                ? [{ symbol: s.symbol, weightBps: weight }]
                                : [];
                            }),
                          },
                        })
                      }
                    />
                    <span>%</span>
                  </label>
                ))}
                <p>
                  Total{' '}
                  {settings.plan.allocations.reduce(
                    (n, a) => n + a.weightBps,
                    0,
                  ) / 100}
                  % · must equal 100%
                </p>
              </fieldset>
              <label>
                Wait until gains reach (USDG)
                <input
                  disabled={working}
                  type="number"
                  min="0.000001"
                  step="any"
                  value={minimum}
                  onChange={(e) => setMinimum(e.target.value)}
                />
              </label>
              <label>
                Maximum purchase per recommendation (USDG)
                <input
                  disabled={working}
                  type="number"
                  min="0.000001"
                  step="any"
                  value={maximum}
                  onChange={(e) => setMaximum(e.target.value)}
                />
              </label>
              <label>
                Maximum estimated fees (% of purchase)
                <input
                  disabled={working}
                  type="number"
                  min="0.05"
                  max="100"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </label>
              <label>
                Maximum estimated network fee (ETH)
                <input
                  disabled={working}
                  type="number"
                  min="0.000000000000000001"
                  max="1"
                  step="any"
                  value={gas}
                  onChange={(e) => setGas(e.target.value)}
                />
              </label>
              <p className="agentic-note">
                The fee check combines estimated ETH gas, valued in USDG, with
                stock pool fees. It excludes price movement and slippage; final
                costs can change.
              </p>
            </>
          )}
          {settings.plan.destination === 'retain' && (
            <p className="agentic-note">
              Your vault shares already reflect lending returns. Holding them
              needs no extra transaction and creates no additional source of
              yield.
            </p>
          )}
          <label>
            Check while you’re away
            <select
              disabled={working}
              value={settings.monitoring ? 'on' : 'off'}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  monitoring: e.target.value === 'on',
                })
              }
            >
              <option value="off">Off — check when I ask</option>
              <option value="on">On — monitor my saved plan</option>
            </select>
          </label>
          {settings.monitoring && (
            <label>
              Preferred check interval
              <select
                disabled={working}
                value={settings.intervalMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    intervalMinutes: Number(e.target.value) as 15 | 60 | 360,
                  })
                }
              >
                <option value="15">Every 15 minutes</option>
                <option value="60">Every hour</option>
                <option value="360">Every 6 hours</option>
              </select>
            </label>
          )}
          <p className="agentic-note">
            Checks are queued and may run later than your preferred interval.
            They never move funds. Open this page for decisions and fresh
            purchase quotes.
          </p>
          {formError && (
            <p className="agentic-error" role="alert">
              {formError}
            </p>
          )}
          <button
            className="dashboard-button"
            disabled={!canManage || working || !!formError}
            type="submit"
          >
            <Check size={16} />
            {working ? 'Saving or checking…' : 'Save plan'}
          </button>
          {saved && (
            <button
              className="agentic-pause"
              type="button"
              disabled={working}
              onClick={() =>
                void action('save', {
                  ...saved.settings,
                  plan: {
                    ...saved.settings.plan,
                    paused: !saved.settings.plan.paused,
                  },
                })
              }
            >
              {saved.settings.plan.paused ? (
                <Play size={15} />
              ) : (
                <Pause size={15} />
              )}{' '}
              {saved.settings.plan.paused
                ? 'Resume saved plan'
                : 'Pause saved plan'}
            </button>
          )}
          {loaded && !saved && (
            <button
              className="agentic-text-button"
              type="button"
              disabled={working}
              onClick={importBrowserPlan}
            >
              Import earlier browser settings
            </button>
          )}
          {message && <output className="agentic-note">{message}</output>}
        </form>
        <div className="agentic-observation">
          <div
            className="agentic-decision"
            aria-live="polite"
            data-ready={!!usableQuote}
          >
            <span className="agentic-decision-label">
              <ScanLine size={18} />
              {recorded ? 'Latest decision' : 'Next step'}
            </span>
            <h2>
              {!owner
                ? 'Connect your lending wallet'
                : !account
                  ? 'Create or open your position'
                  : !loaded
                    ? 'Load your saved plan'
                    : dirty
                      ? 'Save your lending rules'
                      : decision.title}
            </h2>
            <p>
              {!owner
                ? 'Your wallet opens a private profile for your plan and decisions.'
                : !account
                  ? 'Agentic Lending uses your verified position. Create a lending account and add USDG to begin.'
                  : !loaded
                    ? 'Connect your wallet profile to restore your plan.'
                    : dirty
                      ? 'Choose where gains should go and when a purchase is worth the fees.'
                      : decision.reason}
            </p>
            {recorded && (
              <p>
                Checked {time(recorded.checkedAt)}. A saved decision is a
                historical snapshot.
              </p>
            )}
            <div className="agentic-decision-actions">
              {!owner ? (
                <button className="dashboard-button" onClick={onConnect}>
                  Connect wallet <ArrowUpRight size={16} />
                </button>
              ) : !account || !enabled ? (
                <button className="dashboard-button" onClick={onPosition}>
                  Open your position <ArrowUpRight size={16} />
                </button>
              ) : (
                <>
                  {canManage && saved && (
                    <button
                      className="dashboard-button"
                      disabled={working || dirty || !!readState?.blocked}
                      onClick={() => void action('check')}
                    >
                      <RefreshCw size={16} />
                      {working ? 'Checking your plan…' : 'Check now'}
                    </button>
                  )}
                  {!!usableQuote && (
                    <button
                      className="dashboard-button"
                      disabled={working || !!readState?.blocked}
                      onClick={review}
                    >
                      Review purchase <ArrowUpRight size={16} />
                    </button>
                  )}
                  <button
                    className="agentic-text-button"
                    disabled={working}
                    onClick={() =>
                      void loadPlan().catch((e) => setError(e.message))
                    }
                  >
                    Reload saved plan
                  </button>
                </>
              )}
            </div>
            {error && (
              <p className="agentic-error" role="alert">
                {error}
              </p>
            )}
            <p className="agentic-note">
              Every transaction requires your wallet approval. A purchase review
              rechecks your saved limits.
            </p>
          </div>
          <div className="agentic-evidence">
            <h3>Monitoring & evidence</h3>
            <dl>
              <div>
                <dt>Saved plan</dt>
                <dd>
                  {saved?.settings.plan.paused
                    ? 'Paused'
                    : saved?.settings.monitoring
                      ? 'Background checks on'
                      : 'Manual checks'}
                </dd>
              </div>
              <div>
                <dt>Monitoring service</dt>
                <dd>
                  {health === 'healthy' || health === 'running'
                    ? 'Running'
                    : health === 'not_started'
                      ? 'Waiting for first run'
                      : health === 'loading'
                        ? 'Checking…'
                        : 'Delayed — manual checks available'}
                </dd>
              </div>
              <div>
                <dt>Last plan check</dt>
                <dd>{time(saved?.lastCheckedAt ?? null)}</dd>
              </div>
              <div>
                <dt>Next eligible check</dt>
                <dd>
                  {saved?.settings.monitoring && !saved.settings.plan.paused
                    ? time(saved.nextCheckAt)
                    : 'When you ask'}
                </dd>
              </div>
              <div>
                <dt>Position value</dt>
                <dd>
                  {account
                    ? `${formatUnits(account.assetValue, 6)} USDG`
                    : 'Awaiting position'}
                </dd>
              </div>
              <div>
                <dt>Available after rounding reserve</dt>
                <dd>
                  {account
                    ? `${formatUnits(account.spendableWithRoundingBuffer, 6)} USDG`
                    : '—'}
                </dd>
              </div>
              {recorded?.cost && (
                <>
                  <div>
                    <dt>Estimated gas + pool fees</dt>
                    <dd>
                      {formatUnits(recorded.cost.totalFeesUsdg, 6)} USDG (
                      {recorded.cost.feeBps / 100}%)
                    </dd>
                  </div>
                  <div>
                    <dt>ETH price updated</dt>
                    <dd>{time(recorded.cost.ethUpdatedAt)}</dd>
                  </div>
                  <div>
                    <dt>USDG price updated</dt>
                    <dd>{time(recorded.cost.usdgUpdatedAt)}</dd>
                  </div>
                </>
              )}
            </dl>
            {quote?.prepared.purchases?.map((p) => (
              <div className="agentic-quote" key={p.symbol}>
                <strong>{p.symbol}</strong>
                <span>
                  {formatUnits(p.amountIn, 6)} USDG → estimated{' '}
                  {formatUnits(p.amountOut, 18)} tokens
                </span>
                <small>
                  Minimum {formatUnits(p.minimumOut, 18)} · {p.fee / 10000}%
                  pool fee included
                </small>
              </div>
            ))}
            <p className="agentic-note">
              Fee valuations use Chainlink ETH/USD and USDG/USD within their
              published 24-hour heartbeat. Estimates expire after 45 seconds.
              Surplus can include direct transfers; it is not a guarantee of
              interest earned or principal value.
            </p>
          </div>
        </div>
      </div>
      <section className="agentic-history">
        <div className="agentic-section-heading">
          <h2>Decision history</h2>
          <span>Saved with your wallet profile</span>
        </div>
        {history.length ? (
          <ol>
            {history.map((item) => (
              <li key={item.id}>
                <time dateTime={new Date(item.createdAt * 1000).toISOString()}>
                  {time(item.createdAt)}
                  <br />
                  {item.source === 'background'
                    ? 'Background check'
                    : 'Your check'}
                </time>
                <div>
                  <strong>{item.decision.title}</strong>
                  <p>{item.decision.reason}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p>
            Save a plan, then select Check now. Decisions and reasons appear
            here, including when the agent chooses to wait.
          </p>
        )}
        <p className="agentic-note">
          Your latest 50 decisions are shown; up to 100 are retained per
          position. Background checks prepare recommendations only.{' '}
          <Link href="/docs#agentic-lending">How Agentic Lending works ↗</Link>
        </p>
      </section>
    </section>
  );
}
