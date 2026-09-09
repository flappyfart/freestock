'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatUnits, parseUnits } from 'ethers';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import {
  type Prepared,
  type WalletProvider,
} from '../../lib/live/wallet-transaction';
import { ENABLED_STOCKS } from '../../lib/live/basket';
import {
  submitJournaled,
  readJournal,
  clearJournal,
  JOURNAL_EVENT,
  type Journal,
} from '../../lib/live/wallet-journal';
import {
  readAccountReference,
  saveAccountReference,
  forgetAccountReference,
  accountRestoreCandidate,
  rejectedUrlAccountFallback,
  cloudRestoreCandidate,
  type AccountReferenceCandidate,
} from '../../lib/live/account-reference';
import { MechanicalSwitch } from '../mechanical-switch';
import { EXPLORER_URL } from '../../lib/live/config';
import { positionBudget } from '../../lib/live/position-budget';
import {
  validateAgentIntent,
  type AgentAccount,
  type AgentIntent,
  type PilotReadState,
} from '../../lib/live/agentic-lending';
import './pilot-dashboard.css';
import { historyRequest, HISTORY_UPDATED } from '../../lib/live/history-client';
import type { SavedLiveAccount } from '../../lib/live/history-model';
type Account = AgentAccount & {
  account: string;
  accountVersion: 'v1' | 'v2';
  depositCap: string;
  deployment: string;
  principal: string;
  assetValue: string;
  availableGains: string;
  spendableWithRoundingBuffer: string;
  walletUsdg: string;
  walletNvda: string;
  stocks: { symbol: string; address: string; balance: string }[];
  allowance: string;
  block: number;
};
type Receipt = {
  status: string;
  hash: string;
  deployment?: string;
  account?: string;
  block?: number;
  confirmedAt?: string;
  events?: {
    name: string;
    assetAmount: string;
    tokenAmount?: string;
    token?: string;
  }[];
  snapshot?: Account;
};
const toInteger = (value: string) => BigInt(value);
const fmt = (value: string, decimals = 6) => formatUnits(value, decimals);
async function api<T>(path: string, signal?: AbortSignal) {
  const r = await fetch(path, { cache: 'no-store', signal });
  const result = (await r.json()) as T & { error?: string };
  if (!r.ok)
    throw Object.assign(
      Error(result.error ?? 'This action could not be completed.'),
      {
        status: r.status,
      },
    );
  return result;
}
export type PilotAvailability = 'loading' | 'enabled' | 'unavailable' | 'error';
export default function PilotWorkspace({
  owner,
  provider,
  availability,
  scope,
  onReadState,
  agentIntent,
  onAgentIntentHandled,
  onActivity,
}: {
  owner: string;
  provider: WalletProvider;
  availability: PilotAvailability;
  scope: string;
  onReadState: (value: PilotReadState) => void;
  agentIntent: AgentIntent | null;
  onAgentIntentHandled: (id: string) => void;
  onActivity: () => void;
}) {
  const enabled = availability === 'enabled';
  const [account, setAccount] = useState<Account | null>(null),
    [deployment, setDeployment] = useState(''),
    [amount, setAmount] = useState('10'),
    [plan, setPlan] = useState<Prepared | null>(null),
    [pending, setPending] = useState(''),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [storageWarning, setStorageWarning] = useState<string | null>(null),
    [restoreCandidate, setRestoreCandidate] =
      useState<AccountReferenceCandidate | null>(null),
    [lastChecked, setLastChecked] = useState<number | null>(null),
    [refreshWarning, setRefreshWarning] = useState<string | null>(null),
    [now, setNow] = useState(0),
    [journal, setJournal] = useState<Journal | null>(null),
    [recoveryHash, setRecoveryHash] = useState(''),
    [selection, setSelection] = useState('NVDA'),
    [weights, setWeights] = useState<Record<string, number>>(
      Object.fromEntries(ENABLED_STOCKS.map((s) => [s.symbol, 20])),
    );
  const [actionView, setActionView] = useState<
    'deposit' | 'harvest' | 'compound' | 'withdraw' | null
  >(null);
  const [agentNote, setAgentNote] = useState('');
  const [savedPositions, setSavedPositions] = useState<SavedLiveAccount[]>([]);
  const [historyWarning, setHistoryWarning] = useState('');
  const [historyState, setHistoryState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [createAdditional, setCreateAdditional] = useState(false);
  const creatingNew = useRef(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const remembered = useRef(new Set<string>()),
    touched = useRef(false);
  const consumedIntent = useRef<string | null>(null);
  const alive = useRef(true),
    inFlight = useRef(false),
    readEpoch = useRef(0),
    readAbort = useRef<AbortController | null>(null),
    attemptedRestore = useRef(new Set<string>());
  const rememberPosition = useCallback(
    async (reference: string) => {
      if (remembered.current.has(reference)) return;
      try {
        await historyRequest({
          action: 'remember',
          owner,
          deployment: reference,
        });
        if (alive.current) {
          remembered.current.add(reference);
          setHistoryWarning('');
        }
      } catch {
        if (alive.current)
          setHistoryWarning(
            'Your position is verified, but it could not be saved to your wallet profile. Keep its creation transaction and retry in Activity.',
          );
      }
    },
    [owner],
  );
  async function recordActivity(
    hash: string,
    reference: string,
    replaces?: string,
  ) {
    if (!reference) return;
    try {
      await historyRequest({
        action: 'track',
        owner,
        deployment: reference,
        hash,
        ...(replaces ? { replaces } : {}),
      });
      if (alive.current) setHistoryWarning('');
    } catch {
      if (alive.current)
        setHistoryWarning(
          'The wallet result is unchanged, but activity could not be saved. Sync or import the transaction in Activity; do not submit it again.',
        );
    }
  }
  const verifyAccount = useCallback(
    async (reference: string) => {
      const epoch = readEpoch.current;
      const controller = new AbortController();
      readAbort.current = controller;
      try {
        const value = await api<Account>(
          `/api/live/pilot/account?owner=${owner}&deployment=${encodeURIComponent(reference)}`,
          controller.signal,
        );
        if (!alive.current || epoch !== readEpoch.current) return;
        setAccount(value);
        creatingNew.current = false;
        setCreateAdditional(false);
        setRestoreFailed(false);
        setDeployment(value.deployment);
        setLastChecked(Date.now());
        setRefreshWarning(null);
        setStorageWarning(saveAccountReference(owner, value.deployment));
        void rememberPosition(value.deployment);
        const url = new URL(window.location.href);
        url.searchParams.set('deployment', value.deployment);
        window.history.replaceState(null, '', url);
        return value;
      } finally {
        if (readAbort.current === controller) readAbort.current = null;
      }
    },
    // Keep the current owner in the callback boundary for every verified chain read.
    // oxlint-disable-next-line react/react-compiler
    [owner, rememberPosition],
  );
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const result = await api<{ accounts: SavedLiveAccount[] }>(
          `/api/live/history?owner=${owner}`,
          controller.signal,
        );
        if (!alive.current || controller.signal.aborted) return;
        setSavedPositions(result.accounts);
        setHistoryState('ready');
        const search = new URLSearchParams(window.location.search);
        const candidate = cloudRestoreCandidate(
          owner,
          result.accounts,
          creatingNew.current ||
            touched.current ||
            inFlight.current ||
            !!readJournal(owner) ||
            !!search.get('transaction') ||
            !!search.get('deployment') ||
            !!readAccountReference(owner).deployment,
        );
        if (candidate) {
          setDeployment((previous) => previous || candidate.deployment);
          setRestoreCandidate((previous) => previous || candidate);
        }
      } catch {
        if (!controller.signal.aborted && alive.current)
          setHistoryState('error');
      }
    };
    void load();
    window.addEventListener(HISTORY_UPDATED, load);
    return () => {
      controller.abort();
      window.removeEventListener(HISTORY_UPDATED, load);
    };
  }, [owner, historyAttempt]);
  useEffect(() => {
    alive.current = true;
    const epoch = readEpoch.current + 1;
    readEpoch.current = epoch;
    const stopReading = () => {
      readEpoch.current = epoch + 1;
      readAbort.current?.abort();
    };
    const restore = () => {
      const search = new URLSearchParams(window.location.search);
      let saved: Journal | null = null;
      try {
        saved = readJournal(owner);
        setJournal(saved);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'Could not read wallet recovery data.',
        );
      }
      const stored = readAccountReference(owner);
      setStorageWarning(stored.warning);
      const candidate =
        creatingNew.current && !saved?.deployment
          ? null
          : accountRestoreCandidate(
              saved?.deployment,
              search.get('deployment'),
              stored.deployment,
            );
      setPending(saved?.hash || search.get('transaction') || '');
      setDeployment((previous) => previous || candidate?.deployment || '');
      setRestoreCandidate((previous) => previous || candidate);
    };
    window.addEventListener(JOURNAL_EVENT, restore);
    window.addEventListener('storage', restore);
    window.dispatchEvent(new Event(JOURNAL_EVENT));
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive.current = false;
      stopReading();
      inFlight.current = false;
      window.clearInterval(timer);
      window.removeEventListener(JOURNAL_EVENT, restore);
      window.removeEventListener('storage', restore);
    };
  }, [owner]);
  useEffect(() => {
    if (
      !restoreCandidate ||
      account ||
      pending ||
      journal ||
      busy ||
      plan ||
      creatingNew.current ||
      inFlight.current ||
      attemptedRestore.current.has(restoreCandidate.deployment)
    )
      return;
    const epoch = readEpoch.current;
    setRestoreFailed(false);
    attemptedRestore.current.add(restoreCandidate.deployment);
    inFlight.current = true;
    setBusy(true);
    void verifyAccount(restoreCandidate.deployment)
      .catch((e: unknown) => {
        if (!alive.current || epoch !== readEpoch.current) return;
        const status = (e as { status?: number }).status;
        let hasPendingRequest = true;
        try {
          hasPendingRequest =
            !!readJournal(owner) ||
            !!new URLSearchParams(window.location.search).get('transaction');
        } catch {
          // An unreadable journal cannot authorize automatic fallback.
        }
        const fallback = rejectedUrlAccountFallback(
          owner,
          restoreCandidate,
          status,
          hasPendingRequest,
        );
        if (fallback && !attemptedRestore.current.has(fallback.deployment)) {
          setDeployment(fallback.deployment);
          setRestoreCandidate(fallback);
          return;
        }
        setRestoreFailed(true);
        if (status === 422)
          forgetAccountReference(owner, restoreCandidate.deployment);
        setError(
          `Could not restore this account automatically. ${e instanceof Error ? e.message : 'Use the creation transaction to try again.'}`,
        );
      })
      .finally(() => {
        if (!alive.current || epoch !== readEpoch.current) return;
        inFlight.current = false;
        setBusy(false);
      });
  }, [
    account,
    busy,
    journal,
    owner,
    pending,
    plan,
    restoreCandidate,
    verifyAccount,
  ]);
  useEffect(() => {
    if (!account || pending || journal || plan) return;
    const reference = account.deployment;
    const epoch = readEpoch.current;
    const refresh = async () => {
      if (
        document.visibilityState !== 'visible' ||
        inFlight.current ||
        !alive.current
      )
        return;
      // Read the shared journal again: a different tab may have just opened a wallet request.
      try {
        if (readJournal(owner)) return;
      } catch {
        return;
      }
      inFlight.current = true;
      setBusy(true);
      try {
        await verifyAccount(reference);
      } catch (e) {
        if (alive.current && epoch === readEpoch.current)
          setRefreshWarning(
            `Balances could not refresh. ${e instanceof Error ? e.message : 'Try refreshing again.'}`,
          );
      } finally {
        if (alive.current && epoch === readEpoch.current) {
          inFlight.current = false;
          setBusy(false);
        }
      }
    };
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(timer);
  }, [account, journal, owner, pending, plan, verifyAccount]);
  async function act(fn: () => Promise<void>) {
    touched.current = true;
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : 'Wallet action failed. Check its activity before retrying.',
        );
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function loadAccount() {
    const value = await verifyAccount(deployment);
    if (!value) return;
    setPlan(null);
    setReceipt(null);
  }
  async function prepare(action: string) {
    setPlan(null);
    setReceipt(null);
    const params = new URLSearchParams({
      owner,
      action,
      amount,
      deployment: account?.deployment ?? '',
      allocations: JSON.stringify(
        selection === 'basket'
          ? ENABLED_STOCKS.map((s) => ({
              symbol: s.symbol,
              weightBps: weights[s.symbol] * 100,
            })).filter((s) => s.weightBps > 0)
          : [{ symbol: selection, weightBps: 10000 }],
      ),
    });
    const value = await api<Prepared>(`/api/live/pilot/prepare?${params}`);
    if (alive.current) {
      setPlan(value);
      setNow(Date.parse(value.expiresAt) - 45000);
    }
  }
  async function confirm(hash: string, repeat: boolean) {
    const savedJournal = readJournal(owner);
    for (let i = 0; i < (repeat ? 45 : 1); i++) {
      if (!alive.current || readJournal(owner)?.id !== savedJournal?.id) return;
      const value = await api<Receipt>(
        `/api/live/pilot/receipt?owner=${owner}&deployment=${account?.deployment ?? deployment}&hash=${hash}&nonce=${savedJournal?.nonce ?? ''}`,
      );
      if (!alive.current || readJournal(owner)?.id !== savedJournal?.id) return;
      if (value.status !== 'pending') {
        const reference = value.deployment || account?.deployment || deployment;
        // Profile persistence is independent of transaction recovery and must never
        // make a mined transaction look failed or prevent the local journal clearing.
        if (reference) {
          void rememberPosition(reference);
          void recordActivity(
            hash,
            reference,
            savedJournal?.hash && savedJournal.hash !== hash
              ? savedJournal.hash
              : undefined,
          );
        }
        setReceipt(value);
        setPending('');
        const url = new URL(window.location.href);
        url.searchParams.delete('transaction');
        if (value.snapshot && value.deployment) {
          setAccount(value.snapshot);
          creatingNew.current = false;
          setCreateAdditional(false);
          setRestoreFailed(false);
          setDeployment(value.deployment);
          setLastChecked(Date.now());
          setStorageWarning(saveAccountReference(owner, value.deployment));
          url.searchParams.set('deployment', value.deployment);
        }
        window.history.replaceState(null, '', url);
        await clearJournal(owner, savedJournal?.id ?? '');
        if (value.status === 'replaced')
          setError(
            'Another confirmed wallet transaction used this request’s nonce. The original freestock action was not completed.',
          );
        if (value.status === 'cancelled')
          setError(
            'A replacement transaction used this request’s nonce. The original action was not completed. Check the replacement in your wallet for its effects.',
          );
        if (value.status === 'reverted')
          setError(
            'The transaction reverted. Its state changes were undone; the wallet may still have paid gas.',
          );
        return;
      }
      if (repeat)
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
  }
  async function send() {
    if (!plan || (plan.action !== 'withdraw' && !enabled)) return;
    const reviewed = plan;
    // Clear before requesting a signature so a submitted action is never retried as the same preview.
    setPlan(null);
    const hash = await submitJournaled(
      provider,
      reviewed,
      owner,
      account?.account ?? null,
      () => alive.current,
    );
    if (!alive.current || readJournal(owner)?.hash !== hash) return;
    setPending(hash);
    const url = new URL(window.location.href);
    url.searchParams.set('transaction', hash);
    window.history.replaceState(null, '', url);
    if (account?.deployment) void recordActivity(hash, account.deployment);
    await confirm(hash, true);
  }
  const depositAmount = (() => {
    try {
      return /^\d+(?:\.\d{1,6})?$/.test(amount) ? parseUnits(amount, 6) : 0n;
    } catch {
      return 0n;
    }
  })();
  const needsApproval =
    !!account && depositAmount > toInteger(account.allowance);
  const budget = account
    ? positionBudget(
        toInteger(account.principal),
        toInteger(account.assetValue),
      )
    : null;
  const hasPosition =
    !!account &&
    (toInteger(account.assetValue) > 0n || toInteger(account.principal) > 0n);
  const activeView = hasPosition ? actionView : 'deposit';
  const actionBlocked = busy || !!pending || !!journal;
  const newActionBlocked = actionBlocked || !enabled;
  const holdings =
    account?.stocks.filter((stock) => toInteger(stock.balance) > 0n) ?? [];
  const changeView = (
    view: 'deposit' | 'harvest' | 'compound' | 'withdraw' | null,
  ) => {
    setActionView(view);
    setPlan(null);
    setAgentNote('');
  };
  useEffect(() => {
    onReadState({
      scope,
      account,
      blocked: busy || !!pending || !!journal || !!plan,
      error: refreshWarning,
    });
  }, [
    scope,
    account,
    busy,
    pending,
    journal,
    plan,
    refreshWarning,
    onReadState,
  ]);
  useEffect(() => {
    if (!agentIntent || consumedIntent.current === agentIntent.id) return;
    consumedIntent.current = agentIntent.id;
    try {
      if (
        busy ||
        inFlight.current ||
        pending ||
        journal ||
        plan ||
        readJournal(owner) ||
        new URLSearchParams(window.location.search).get('transaction')
      )
        throw Error(
          'Finish your current action before opening an Agentic Lending recommendation.',
        );
      validateAgentIntent(agentIntent, scope, account, owner, Date.now());
      // oxlint-disable-next-line react/react-compiler -- Consume a scoped one-shot parent request by filling the manual review form, without preparing or submitting a transaction.
      setAmount(formatUnits(agentIntent.amount, 6));
      setSelection(
        agentIntent.allocations.length === 1
          ? agentIntent.allocations[0].symbol
          : 'basket',
      );
      setWeights(
        Object.fromEntries(
          ENABLED_STOCKS.map((s) => [
            s.symbol,
            (agentIntent.allocations.find((a) => a.symbol === s.symbol)
              ?.weightBps ?? 0) / 100,
          ]),
        ),
      );
      setActionView('harvest');
      setError('');
      setAgentNote(
        'Your Agentic Lending plan filled in this purchase. Review a fresh quote below; its costs may differ from the recommendation. No transaction has been submitted.',
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Check your recommendation again.',
      );
    }
    onAgentIntentHandled(agentIntent.id);
  }, [
    agentIntent,
    scope,
    account,
    owner,
    busy,
    pending,
    journal,
    plan,
    onAgentIntentHandled,
  ]);
  function beginNewPosition() {
    if (actionBlocked || plan || readJournal(owner)) return;
    touched.current = true;
    creatingNew.current = true;
    readEpoch.current++;
    readAbort.current?.abort();
    setAccount(null);
    setDeployment('');
    setRestoreCandidate(null);
    setRestoreFailed(false);
    setCreateAdditional(true);
    setError('');
    setReceipt(null);
    setActionView(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('deployment');
    window.history.replaceState(null, '', url);
  }
  const restoring =
    !account &&
    (historyState === 'loading' ||
      (!!restoreCandidate && !restoreFailed && !createAdditional));
  const choosingSaved =
    !account && savedPositions.length > 0 && !createAdditional;
  const canCreate =
    !account &&
    historyState === 'ready' &&
    !restoring &&
    !choosingSaved &&
    (!restoreCandidate || createAdditional);
  const focusedAction = !!plan || !!pending || !!journal;
  return (
    <section className="pilot-workspace pilot-dashboard">
      <header className="pd-heading">
        <div>
          <h2>
            {hasPosition
              ? 'Your position'
              : account
                ? 'Fund your position'
                : 'Create your position'}
          </h2>
          <p>
            {hasPosition
              ? 'Lend USDG. Turn available gains into stocks.'
              : 'One USDG lending position, owned by your wallet.'}
          </p>
        </div>
        <span className="pd-network">Robinhood Chain</span>
      </header>
      {agentNote && <p className="pd-notice">{agentNote}</p>}
      {historyWarning && (
        <output className="pd-notice">
          {historyWarning}{' '}
          <button type="button" onClick={onActivity}>
            Open Activity
          </button>
        </output>
      )}
      {savedPositions.length > 0 && !focusedAction && (
        <label className="pd-saved-position">
          {account ? 'Your saved positions' : 'Choose your existing position'}
          <select
            disabled={actionBlocked || !!plan}
            value={account?.deployment ?? ''}
            onChange={(e) => {
              touched.current = true;
              setDeployment(e.target.value);
              void act(async () => {
                await verifyAccount(e.target.value);
                setPlan(null);
                setReceipt(null);
              });
            }}
          >
            <option value="" disabled>
              Choose a saved position
            </option>
            {savedPositions.map((p) => (
              <option key={p.account} value={p.deployment}>
                {p.account.slice(0, 8)}…{p.account.slice(-6)} · Steakhouse USDG
              </option>
            ))}
          </select>
          <span>
            Saved to your wallet profile. Connect the same wallet on another
            device to restore your positions.
          </span>
        </label>
      )}

      {!hasPosition && !restoring && !focusedAction && (
        <ol className="pd-steps" aria-label="Position setup">
          <li
            data-complete={!!account}
            aria-current={!account ? 'step' : undefined}
          >
            <span>1</span>Create position
          </li>
          <li aria-current={account ? 'step' : undefined}>
            <span>2</span>Add USDG
          </li>
          <li>
            <span>3</span>Choose stock picks
          </li>
        </ol>
      )}

      {availability === 'loading' && (
        <p className="pd-notice" aria-live="polite">
          Checking your wallet connection. Your current review and wallet
          request are saved.
        </p>
      )}
      {(availability === 'unavailable' || availability === 'error') && (
        <p className="pd-notice">
          We couldn’t verify your wallet connection. Reconnect before starting
          another action.
        </p>
      )}
      {refreshWarning && (
        <p className="pd-notice" aria-live="polite">
          {refreshWarning}
        </p>
      )}
      {storageWarning && (
        <p className="pd-notice" aria-live="polite">
          {storageWarning}
        </p>
      )}

      {account && hasPosition && !focusedAction && (
        <div className="pd-position">
          <div className="pd-position-title">
            <div>
              <h3>Steakhouse USDG</h3>
              <span>
                USDG lending
                {account.accountVersion === 'v1'
                  ? ' · Older account: 100 USDG limit'
                  : ' · No Freestock deposit cap'}
              </span>
            </div>
            <button
              className="pd-refresh"
              disabled={actionBlocked}
              onClick={() => void act(loadAccount)}
              aria-label="Refresh position balances"
            >
              <RefreshCw size={17} />
            </button>
          </div>
          <div className="pd-balances">
            <div>
              <span>Position balance</span>
              <strong>
                {fmt(account.assetValue)} <small>USDG</small>
              </strong>
            </div>
            <div>
              <span>Available to convert</span>
              <strong>
                {fmt(account.spendableWithRoundingBuffer)} <small>USDG</small>
              </strong>
            </div>
          </div>
          <dl className="pd-account-facts">
            <div>
              <dt>Principal baseline</dt>
              <dd>{fmt(account.principal)} USDG</dd>
            </div>
            <div>
              <dt>In your wallet</dt>
              <dd>{fmt(account.walletUsdg)} USDG</dd>
            </div>
          </dl>
          {budget && (
            <details className="pd-budget">
              <summary>How available gains are calculated</summary>
              <dl>
                <div>
                  <dt>Value above your baseline</dt>
                  <dd>{fmt(budget.surplus.toString())} USDG</dd>
                </div>
                <div>
                  <dt>Rounding reserve</dt>
                  <dd>−{fmt(budget.reserve.toString())} USDG</dd>
                </div>
                <div>
                  <dt>Available for stock purchases</dt>
                  <dd>{fmt(account.spendableWithRoundingBuffer)} USDG</dd>
                </div>
              </dl>
              {budget.shortfall > 0n && (
                <p className="pd-notice">
                  Your position is {fmt(budget.shortfall.toString())} USDG below
                  its baseline. This shortfall must recover before new gains
                  become available to convert.
                </p>
              )}
              <p className="pd-meta">
                The position includes vault value and idle USDG. Direct
                transfers into this account also count toward surplus. This is
                not a total of interest earned, and the baseline does not
                guarantee your capital.
              </p>
            </details>
          )}
          {toInteger(account.spendableWithRoundingBuffer) <= 0n && (
            <p className="pd-lending-status">
              Your USDG is lending. When gains are available, you can put them
              toward your stock picks.
            </p>
          )}
          {hasPosition && (
            <div className="pd-position-actions">
              <button
                className="pd-button"
                disabled={
                  newActionBlocked ||
                  toInteger(account.spendableWithRoundingBuffer) <= 0n
                }
                onClick={() => changeView('harvest')}
              >
                Buy stocks with gains <ArrowUpRight size={16} />
              </button>
              <button
                className="pd-button pd-secondary"
                disabled={actionBlocked}
                onClick={() => changeView('deposit')}
              >
                Add funds
              </button>
              <details className="pd-more">
                <summary>More actions</summary>
                <div>
                  <button disabled={actionBlocked} onClick={beginNewPosition}>
                    Create another position
                    {account.accountVersion === 'v1'
                      ? ' without the old cap'
                      : ''}
                  </button>
                  <button
                    disabled={actionBlocked}
                    onClick={(event) => {
                      event.currentTarget
                        .closest('details')
                        ?.removeAttribute('open');
                      changeView('compound');
                    }}
                  >
                    Reserve gains as principal
                  </button>
                  <button
                    disabled={actionBlocked}
                    onClick={(event) => {
                      event.currentTarget
                        .closest('details')
                        ?.removeAttribute('open');
                      changeView('withdraw');
                    }}
                  >
                    Withdraw all USDG
                  </button>
                </div>
              </details>
            </div>
          )}
          {lastChecked && (
            <p className="pd-updated">
              Checked{' '}
              <time dateTime={new Date(lastChecked).toISOString()}>
                {new Date(lastChecked).toLocaleTimeString()}
              </time>{' '}
              · block {account.block.toLocaleString()}
            </p>
          )}
        </div>
      )}

      <p className="pd-meta">
        Real funds. Capital can lose value; withdrawals depend on liquidity.{' '}
        <a
          href="https://robinhood.com/rhj/stocktokens/"
          target="_blank"
          rel="noreferrer"
        >
          Stock Token terms <ArrowUpRight size={13} />
        </a>
      </p>

      {restoring && !focusedAction && (
        <output className="pd-onboarding-status">
          <RefreshCw size={22} />
          <h3>Looking for your positions</h3>
          <p>
            We’re checking saved accounts for this wallet before creating
            anything new.
          </p>
        </output>
      )}
      {!account && historyState === 'error' && !focusedAction && (
        <div className="pd-onboarding-status">
          <h3>We couldn’t check your saved positions</h3>
          <p>
            Try again, or restore an existing account using its creation
            transaction below.
          </p>
          <button
            className="pd-button"
            onClick={() => {
              setHistoryState('loading');
              setHistoryAttempt((v) => v + 1);
            }}
          >
            Check again
          </button>
        </div>
      )}
      {restoreFailed && !account && !focusedAction && (
        <div className="pd-onboarding-status">
          <h3>Let’s recover your position</h3>
          <p>
            {error ||
              'We could not verify this saved position. Retry the check or create a separate account.'}
          </p>
          <button
            className="pd-button"
            disabled={actionBlocked}
            onClick={() => {
              if (restoreCandidate)
                attemptedRestore.current.delete(restoreCandidate.deployment);
              setRestoreFailed(false);
              setError('');
              setRestoreCandidate((v) => (v ? { ...v } : null));
            }}
          >
            Try restoring again
          </button>
          <button
            className="pd-text-button"
            disabled={actionBlocked}
            onClick={beginNewPosition}
          >
            Create a separate position
          </button>
        </div>
      )}
      {choosingSaved && !restoring && !focusedAction && (
        <p className="pd-meta">
          Select a position above to continue.{' '}
          <button
            type="button"
            className="pd-text-button"
            onClick={beginNewPosition}
          >
            Create a separate position
          </button>
        </p>
      )}
      {!focusedAction &&
        (canCreate ? (
          <div className="pd-setup">
            <div className="pd-setup-copy">
              <h3>
                {createAdditional
                  ? 'Create a new lending position'
                  : 'Create your first lending position'}
              </h3>
              <p>
                Set up a personal account that only your wallet controls. You’ll
                review the ETH network fee first. Your USDG stays in your wallet
                until the next step.
              </p>
            </div>
            <button
              className="pd-button"
              disabled={newActionBlocked}
              onClick={() => void act(() => prepare('deploy'))}
            >
              Review setup fee <ArrowUpRight size={16} />
            </button>
          </div>
        ) : (
          account &&
          activeView && (
            <div className="pd-action-panel">
              <div className="pd-panel-heading">
                <div>
                  <h3>
                    {activeView === 'deposit'
                      ? 'Add USDG'
                      : activeView === 'harvest'
                        ? 'Buy stocks with gains'
                        : activeView === 'compound'
                          ? 'Reserve your gains'
                          : 'Withdraw your position'}
                  </h3>
                  <p>
                    {activeView === 'deposit'
                      ? needsApproval
                        ? 'First, allow this account to use the amount you choose. Then confirm a separate deposit.'
                        : 'Approval is ready. Review the deposit to start lending.'
                      : activeView === 'harvest'
                        ? 'Choose a stock or split your purchase across a basket.'
                        : activeView === 'compound'
                          ? 'Add available gains to the principal baseline. Your vault shares already accumulate returns.'
                          : 'Return the full remaining account value to your wallet.'}
                  </p>
                </div>
                {hasPosition && (
                  <button
                    className="pd-text-button"
                    disabled={actionBlocked}
                    onClick={() => changeView(null)}
                  >
                    Close
                  </button>
                )}
              </div>
              {activeView !== 'withdraw' && (
                <div className="pd-amount-row">
                  <label className="pd-amount-label">
                    {activeView === 'deposit'
                      ? 'Deposit amount'
                      : 'Gains to use'}
                    <div className="pd-amount-input">
                      <input
                        type="number"
                        min="0.000001"
                        step="0.000001"
                        value={amount}
                        disabled={busy}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          setPlan(null);
                        }}
                      />
                      <span>USDG</span>
                    </div>
                  </label>
                  <p>
                    {activeView === 'deposit'
                      ? `${fmt(account.walletUsdg)} USDG in your wallet`
                      : `${fmt(account.spendableWithRoundingBuffer)} USDG available`}
                  </p>
                </div>
              )}
              {activeView === 'deposit' &&
                toInteger(account.walletUsdg) === 0n && (
                  <p className="pd-notice">
                    Your wallet has no USDG on Robinhood Chain yet. Add USDG to
                    this wallet, then refresh your position to continue.
                  </p>
                )}
              {activeView === 'harvest' && (
                <div className="pd-stock-picker">
                  <MechanicalSwitch
                    label="Split across a basket"
                    description={
                      selection === 'basket'
                        ? 'Set a percentage for each selected stock.'
                        : 'Purchase one Stock Token.'
                    }
                    checked={selection === 'basket'}
                    disabled={busy}
                    onChange={(checked) => {
                      setSelection(checked ? 'basket' : 'NVDA');
                      setPlan(null);
                    }}
                  />
                  {selection !== 'basket' ? (
                    <label>
                      Stock Token
                      <select
                        value={selection}
                        disabled={busy}
                        onChange={(e) => {
                          setSelection(e.target.value);
                          setPlan(null);
                        }}
                      >
                        {ENABLED_STOCKS.map((stock) => (
                          <option key={stock.symbol} value={stock.symbol}>
                            {stock.symbol}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <div className="pilot-weights">
                      {ENABLED_STOCKS.map((stock) => (
                        <label key={stock.symbol}>
                          {stock.symbol} %
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={weights[stock.symbol]}
                            disabled={busy}
                            onChange={(e) => {
                              setWeights((v) => ({
                                ...v,
                                [stock.symbol]: Number(e.target.value),
                              }));
                              setPlan(null);
                            }}
                          />
                        </label>
                      ))}
                      <p>
                        Total:{' '}
                        {Object.values(weights).reduce(
                          (sum, value) => sum + value,
                          0,
                        )}
                        % · must equal 100%.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="pd-panel-actions">
                {activeView === 'deposit' ? (
                  <button
                    className="pd-button"
                    disabled={
                      newActionBlocked ||
                      depositAmount <= 0n ||
                      depositAmount > toInteger(account.walletUsdg)
                    }
                    onClick={() =>
                      void act(() =>
                        prepare(needsApproval ? 'approve' : 'deposit'),
                      )
                    }
                  >
                    {needsApproval ? 'Review USDG approval' : 'Review deposit'}
                    <ArrowUpRight size={16} />
                  </button>
                ) : (
                  <button
                    className="pd-button"
                    disabled={
                      activeView === 'withdraw'
                        ? actionBlocked
                        : newActionBlocked
                    }
                    onClick={() => void act(() => prepare(activeView))}
                  >
                    {activeView === 'harvest'
                      ? 'Review stock purchase'
                      : activeView === 'compound'
                        ? 'Review reserve'
                        : 'Review full withdrawal'}
                    <ArrowUpRight size={16} />
                  </button>
                )}
              </div>
            </div>
          )
        ))}

      {plan && (
        <div className="pd-review" aria-live="polite">
          <div className="pd-panel-heading">
            <div>
              <h3>Review your transaction</h3>
              <strong>
                {plan.action === 'deploy'
                  ? 'Create lending account'
                  : `${fmt(plan.assets)} USDG`}
              </strong>
            </div>
            <span className="pd-network">Your wallet approves</span>
          </div>
          <p>{plan.summary}</p>
          {!!plan.purchases?.length && (
            <div className="pd-quote-list">
              <h4>What your gains could buy</h4>
              {plan.purchases.map((purchase) => (
                <div className="pd-quote" key={purchase.symbol}>
                  <strong>{purchase.symbol}</strong>
                  <dl>
                    <div>
                      <dt>USDG spent</dt>
                      <dd>{fmt(purchase.amountIn)}</dd>
                    </div>
                    <div>
                      <dt>Estimated tokens received</dt>
                      <dd>{fmt(purchase.amountOut, 18)}</dd>
                    </div>
                    <div>
                      <dt>Minimum tokens received</dt>
                      <dd>{fmt(purchase.minimumOut, 18)}</dd>
                    </div>
                  </dl>
                  <p className="pd-meta">
                    {purchase.fee / 10000}% pool fee included in the estimate.
                    Minimum allows 1% less than the quote, rounded down.
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="pd-meta">
            Estimated network fee: {fmt(plan.estimatedGasCostWei, 18)} ETH.
            Includes a 20% gas-limit buffer; your wallet shows the final fee.
            Gas is separate from USDG gains.
          </p>
          {!plan.hasGasBalance && (
            <p className="pd-notice">
              Your wallet needs more ETH for the estimated gas.
            </p>
          )}
          <p className="pd-meta">
            Preview expires {new Date(plan.expiresAt).toLocaleTimeString()}.
            Review all details in your wallet.
          </p>
          <button
            type="button"
            className="pd-text-button"
            disabled={busy || !!journal}
            onClick={() => setPlan(null)}
          >
            Back to edit
          </button>
          <button
            className="pd-button"
            disabled={
              busy ||
              !!journal ||
              (!plan.canSubmit && now < Date.parse(plan.expiresAt)) ||
              (plan.action !== 'withdraw' && !enabled)
            }
            onClick={() =>
              void act(
                now >= Date.parse(plan.expiresAt)
                  ? () => prepare(plan.action)
                  : send,
              )
            }
          >
            {now >= Date.parse(plan.expiresAt)
              ? 'Refresh review'
              : 'Confirm in wallet'}
            <ArrowUpRight size={16} />
          </button>
        </div>
      )}

      {(pending || journal) && (
        <div className="pd-recovery" aria-live="polite">
          <h3>
            {pending ? 'Awaiting confirmation' : 'Check your wallet request'}
          </h3>
          <p>
            {pending
              ? 'Your transaction was submitted. Do not repeat this action while it is pending.'
              : 'Your wallet may still be awaiting approval, or its response was interrupted. Check wallet activity first. No automatic retry will occur.'}
          </p>
          {pending && (
            <div className="pd-panel-actions">
              <button
                className="pd-button"
                disabled={busy}
                onClick={() => void act(() => confirm(pending, false))}
              >
                Check confirmation
              </button>
              <a
                href={`${EXPLORER_URL}/tx/${pending}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction <ArrowUpRight size={14} />
              </a>
            </div>
          )}
          <details className="pd-inline-details" open={!pending}>
            <summary>Recover a submitted or replaced transaction</summary>
            <label>
              Recovery transaction hash
              <input
                value={recoveryHash}
                onChange={(e) => setRecoveryHash(e.target.value)}
                placeholder="Submitted, sped-up or cancellation transaction hash"
                disabled={busy}
              />
            </label>
            <button
              className="pd-button pd-secondary"
              disabled={busy || !recoveryHash}
              onClick={() => void act(() => confirm(recoveryHash, false))}
            >
              Verify recovery transaction
            </button>
            <p>
              Recovery checks the sender and original wallet nonce. Pending
              references are saved only in this browser. Account values and
              confirmation always come from the chain.
            </p>
          </details>
        </div>
      )}

      {receipt?.status === 'confirmed' && (
        <div className="pd-confirmed" aria-live="polite">
          <strong>Confirmed on Robinhood Chain</strong>
          {receipt.block && (
            <p className="pd-meta">
              Block {receipt.block.toLocaleString()}
              {receipt.confirmedAt
                ? ` · ${new Date(receipt.confirmedAt).toLocaleString()}`
                : ''}
            </p>
          )}
          {receipt.events?.map((event, i) => (
            <p key={i}>
              {event.name === 'StockPurchased'
                ? `Received from this conversion: ${fmt(event.tokenAmount!, 18)} ${ENABLED_STOCKS.find((stock) => stock.address.toLowerCase() === event.token?.toLowerCase())?.symbol ?? 'Stock'} tokens for ${fmt(event.assetAmount)} USDG.`
                : `${event.name}: ${fmt(event.assetAmount)} USDG.`}
            </p>
          ))}
          <a
            href={`${EXPLORER_URL}/tx/${receipt.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            View confirmed transaction <ArrowUpRight size={14} />
          </a>
          <a
            href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ hash: receipt.hash, account: receipt.account, block: receipt.block, confirmedAt: receipt.confirmedAt, events: receipt.events }, null, 2))}`}
            download={`freestock-receipt-${receipt.hash}.json`}
          >
            Save receipt
          </a>
          <p className="pd-meta">
            Activity saves verified records to your wallet profile. If saving is
            unavailable, keep this receipt and sync it later. The explorer
            retains the onchain transaction.
          </p>
        </div>
      )}
      {busy && (
        <p className="pd-progress" aria-live="polite">
          Checking the chain or waiting for your wallet…
        </p>
      )}
      {error && (
        <p className="pd-notice" role="alert">
          {error}
        </p>
      )}

      {account && hasPosition && !focusedAction && (
        <section className="pd-holdings">
          <h3>Stock tokens in your wallet</h3>
          <p className="pd-meta">
            Includes tokens acquired elsewhere. Conversion receipts identify the
            stocks bought through this account.
          </p>
          {holdings.length > 0 ? (
            <dl>
              {holdings.map((stock) => (
                <div key={stock.symbol}>
                  <dt>{stock.symbol}</dt>
                  <dd>
                    {fmt(stock.balance, 18)} <span>tokens</span>
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>Stock purchases will appear in your wallet here.</p>
          )}
        </section>
      )}

      <details className="pd-details" hidden={focusedAction}>
        <summary>
          {account ? 'Position details' : 'Already have an account? Restore it'}
        </summary>
        {account ? (
          <>
            <a
              href={`${EXPLORER_URL}/address/${account.account}`}
              target="_blank"
              rel="noreferrer"
            >
              View your lending account <ArrowUpRight size={14} />
            </a>
            <p>
              Gains are value above the principal baseline after a 0.000002 USDG
              rounding buffer. Donations also count as gains. Each transaction
              preview checks withdrawal availability.
            </p>
            <p>
              Balances refresh every 30 seconds while this tab is visible and no
              review or wallet action is in progress.
            </p>
          </>
        ) : (
          <>
            <label>
              Account creation transaction
              <input
                value={deployment}
                placeholder="0x…"
                onChange={(e) => {
                  touched.current = true;
                  setDeployment(e.target.value);
                  setPlan(null);
                }}
                disabled={busy}
              />
            </label>
            <p>
              This verifies the account code, owner and lending route. Verified
              references are saved in this browser. Keep the creation
              transaction or bookmark this page to recover on another device.
            </p>
            <button
              className="pd-button pd-secondary"
              disabled={busy || !deployment}
              onClick={() => void act(loadAccount)}
            >
              {busy && restoreCandidate
                ? 'Checking account…'
                : 'Load and verify account'}
            </button>
          </>
        )}
      </details>
      <p className="pd-footnote">
        Every action requires your wallet approval. Background conversion is not
        active.
      </p>
    </section>
  );
}
