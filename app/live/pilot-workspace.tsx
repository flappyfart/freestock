"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits } from "ethers";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { type Prepared, type WalletProvider } from "../../lib/live/wallet-transaction";
import { ENABLED_STOCKS } from "../../lib/live/basket";
import {
  submitJournaled,
  readJournal,
  clearJournal,
  JOURNAL_EVENT,
  type Journal,
} from "../../lib/live/wallet-journal";
import {
  readAccountReference,
  saveAccountReference,
  forgetAccountReference,
  accountRestoreCandidate,
  rejectedUrlAccountFallback,
  type AccountReferenceCandidate,
} from "../../lib/live/account-reference";
import { MechanicalSwitch } from "../mechanical-switch";
import { EXPLORER_URL } from "../../lib/live/config";
type Account = {
  account: string;
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
  events?: {
    name: string;
    assetAmount: string;
    tokenAmount?: string;
    token?: string;
  }[];
  snapshot?: Account;
};
const fmt = (value: string, decimals = 6) => formatUnits(value, decimals);
async function api<T>(path: string, signal?: AbortSignal) {
  const r = await fetch(path, { cache: "no-store", signal });
  const result = (await r.json()) as T & { error?: string };
  if (!r.ok)
    throw Object.assign(Error(result.error ?? "This action could not be completed."), {
      status: r.status,
    });
  return result;
}
export type PilotAvailability = "loading" | "enabled" | "unavailable" | "error";
export default function PilotWorkspace({
  owner,
  provider,
  availability,
}: {
  owner: string;
  provider: WalletProvider;
  availability: PilotAvailability;
}) {
  const enabled = availability === "enabled";
  const [account, setAccount] = useState<Account | null>(null),
    [deployment, setDeployment] = useState(""),
    [amount, setAmount] = useState("10"),
    [plan, setPlan] = useState<Prepared | null>(null),
    [pending, setPending] = useState(""),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [storageWarning, setStorageWarning] = useState<string | null>(null),
    [restoreCandidate, setRestoreCandidate] = useState<AccountReferenceCandidate | null>(null),
    [lastChecked, setLastChecked] = useState<number | null>(null),
    [refreshWarning, setRefreshWarning] = useState<string | null>(null),
    [acknowledged, setAcknowledged] = useState(false),
    [now, setNow] = useState(0),
    [journal, setJournal] = useState<Journal | null>(null),
    [recoveryHash, setRecoveryHash] = useState(""),
    [selection, setSelection] = useState("NVDA"),
    [weights, setWeights] = useState<Record<string, number>>(
      Object.fromEntries(ENABLED_STOCKS.map((s) => [s.symbol, 20])),
    );
  const alive = useRef(true),
    inFlight = useRef(false),
    readEpoch = useRef(0),
    readAbort = useRef<AbortController | null>(null),
    attemptedRestore = useRef(new Set<string>());
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
        setDeployment(value.deployment);
        setLastChecked(Date.now());
        setRefreshWarning(null);
        setStorageWarning(saveAccountReference(owner, value.deployment));
        const url = new URL(window.location.href);
        url.searchParams.set("deployment", value.deployment);
        window.history.replaceState(null, "", url);
        return value;
      } finally {
        if (readAbort.current === controller) readAbort.current = null;
      }
    },
    // Keep the current owner in the callback boundary for every verified chain read.
    // oxlint-disable-next-line react/react-compiler
    [owner],
  );
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
        setError(e instanceof Error ? e.message : "Could not read wallet recovery data.");
      }
      const stored = readAccountReference(owner);
      setStorageWarning(stored.warning);
      const candidate = accountRestoreCandidate(
        saved?.deployment,
        search.get("deployment"),
        stored.deployment,
      );
      setPending(saved?.hash || search.get("transaction") || "");
      setDeployment((previous) => previous || candidate?.deployment || "");
      setRestoreCandidate((previous) => previous || candidate);
    };
    window.addEventListener(JOURNAL_EVENT, restore);
    window.addEventListener("storage", restore);
    window.dispatchEvent(new Event(JOURNAL_EVENT));
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive.current = false;
      stopReading();
      inFlight.current = false;
      window.clearInterval(timer);
      window.removeEventListener(JOURNAL_EVENT, restore);
      window.removeEventListener("storage", restore);
    };
  }, [owner]);
  useEffect(() => {
    if (
      !restoreCandidate ||
      account ||
      pending ||
      journal ||
      busy ||
      inFlight.current ||
      attemptedRestore.current.has(restoreCandidate.deployment)
    )
      return;
    const epoch = readEpoch.current;
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
            !!new URLSearchParams(window.location.search).get("transaction");
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
        if (status === 422) forgetAccountReference(owner, restoreCandidate.deployment);
        setError(
          `Could not restore this account automatically. ${e instanceof Error ? e.message : "Use the creation transaction to try again."}`,
        );
      })
      .finally(() => {
        if (!alive.current || epoch !== readEpoch.current) return;
        inFlight.current = false;
        setBusy(false);
      });
  }, [account, busy, journal, owner, pending, restoreCandidate, verifyAccount]);
  useEffect(() => {
    if (!account || pending || journal || plan) return;
    const reference = account.deployment;
    const epoch = readEpoch.current;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || inFlight.current || !alive.current) return;
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
            `Balances could not refresh. ${e instanceof Error ? e.message : "Try refreshing again."}`,
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
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : "Wallet action failed. Check its activity before retrying.",
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
      deployment: account?.deployment ?? "",
      allocations: JSON.stringify(
        selection === "basket"
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
        `/api/live/pilot/receipt?owner=${owner}&deployment=${account?.deployment ?? deployment}&hash=${hash}&nonce=${savedJournal?.nonce ?? ""}`,
      );
      if (!alive.current || readJournal(owner)?.id !== savedJournal?.id) return;
      if (value.status !== "pending") {
        setReceipt(value);
        setPending("");
        const url = new URL(window.location.href);
        url.searchParams.delete("transaction");
        if (value.snapshot && value.deployment) {
          setAccount(value.snapshot);
          setDeployment(value.deployment);
          setLastChecked(Date.now());
          setStorageWarning(saveAccountReference(owner, value.deployment));
          url.searchParams.set("deployment", value.deployment);
        }
        window.history.replaceState(null, "", url);
        await clearJournal(owner, savedJournal?.id ?? "");
        if (value.status === "replaced")
          setError(
            "Another confirmed wallet transaction used this request’s nonce. The original freestock action was not completed.",
          );
        if (value.status === "cancelled")
          setError(
            "The replacement cancelled the wallet request. The original action was not completed.",
          );
        if (value.status === "reverted")
          setError(
            "The transaction reverted. Its state changes were undone; the wallet may still have paid gas.",
          );
        return;
      }
      if (repeat) await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
  }
  async function send() {
    if (!plan || (!acknowledged && plan.action !== "withdraw")) return;
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
    url.searchParams.set("transaction", hash);
    window.history.replaceState(null, "", url);
    await confirm(hash, true);
  }
  return (
    <section className="earn-section pilot-workspace">
      <div className="section-title">
        <h2>Your wallet pilot</h2>
        <span className="earn-pill">Norway · 5 stocks · 100 USDG deposit limit</span>
      </div>
      <p>
        Deposit USDG into lending, let returns accumulate, then use available gains to buy your
        chosen Stock Tokens or basket. Every action is approved by you. Background auto-conversion
        is not active.
      </p>
      <p className="earn-small">
        Access is based on the participant’s Norway and non-U.S.-person declarations, not an
        identity verification or legal approval.{" "}
        <a href="https://robinhood.com/rhj/stocktokens/" target="_blank" rel="noreferrer">
          Issuer terms and restrictions ↗
        </a>
      </p>
      <label className="pilot-ack">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => {
            setAcknowledged(e.target.checked);
            setPlan(null);
          }}
          disabled={busy}
        />
        <span>
          I am the declared participant, the issuer restrictions do not exclude me, and I understand
          this uses real funds. Capital can lose value; withdrawals depend on liquidity. I have
          reviewed the issuer terms.
        </span>
      </label>
      {availability === "loading" && (
        <p aria-live="polite">
          Checking access before new actions… Existing accounts can still be restored.
        </p>
      )}
      {(availability === "unavailable" || availability === "error") && (
        <p className="earn-warning">
          New actions require confirmed participant access. An existing verified account can still
          be recovered and withdrawn from.
        </p>
      )}
      {refreshWarning && (
        <p className="earn-small" aria-live="polite">
          {refreshWarning}
        </p>
      )}
      {storageWarning && (
        <p className="earn-small live-storage-note" aria-live="polite">
          {storageWarning}
        </p>
      )}
      {!account ? (
        <div className="live-grid">
          <article className="earn-builder">
            <h3>Create your account</h3>
            <p>
              The account belongs to your wallet. Creation costs ETH for gas and does not transfer
              USDG.
            </p>
            <button
              className="earn-button"
              disabled={busy || !!pending || !!journal || !enabled || !acknowledged}
              onClick={() => void act(() => prepare("deploy"))}
            >
              Review account creation <ArrowUpRight size={16} />
            </button>
          </article>
          <article className="earn-builder">
            <h3>Restore an account</h3>
            <label>
              Account creation transaction
              <input
                value={deployment}
                placeholder="0x…"
                onChange={(e) => {
                  setDeployment(e.target.value);
                  setPlan(null);
                }}
                disabled={busy}
              />
            </label>
            <p className="earn-small">
              Use the creation transaction from your wallet. This checks its code, owner and fixed
              lending route. A verified account reference is saved in this browser for your next
              visit. Keep the creation transaction or bookmark this page for recovery on another
              device.
            </p>
            <button
              className="earn-button"
              disabled={busy || !deployment}
              onClick={() => void act(loadAccount)}
            >
              {busy && restoreCandidate && !account
                ? "Checking account…"
                : "Load and verify account"}
            </button>
          </article>
        </div>
      ) : (
        <>
          <div className="earn-stats">
            <div>
              <span>Principal baseline</span>
              <strong>
                {fmt(account.principal)}
                <small> USDG</small>
              </strong>
            </div>
            <div>
              <span>Account value</span>
              <strong>
                {fmt(account.assetValue)}
                <small> USDG</small>
              </strong>
            </div>
            <div>
              <span>Available gains</span>
              <strong>
                {fmt(account.spendableWithRoundingBuffer)}
                <small> USDG</small>
              </strong>
            </div>
            <div>
              <span>Wallet USDG</span>
              <strong>{fmt(account.walletUsdg)}</strong>
            </div>
          </div>
          <p className="earn-small">
            Balances at block {account.block.toLocaleString()}. Gains are value above the principal
            baseline after a 0.000002 USDG rounding buffer. Donations also count as gains;
            withdrawal availability is checked in each preview. Vault shares already accumulate
            returns.
          </p>
          <div className="model-prices">
            {account.stocks.map((s) => (
              <div key={s.symbol}>
                <strong>{s.symbol}</strong>
                <span>{fmt(s.balance, 18)} tokens</span>
              </div>
            ))}
          </div>
          <div className="live-actions">
            <a
              className="earn-link"
              href={`${EXPLORER_URL}/address/${account.account}`}
              target="_blank"
              rel="noreferrer"
            >
              Your account <ArrowUpRight size={14} />
            </a>
            <button
              className="earn-link"
              disabled={busy || !!pending || !!journal}
              onClick={() => void act(loadAccount)}
            >
              <RefreshCw size={14} />
              Refresh actual balances
            </button>
          </div>
          {lastChecked && (
            <p className="earn-small live-last-checked">
              Last checked{" "}
              <time dateTime={new Date(lastChecked).toISOString()}>
                {new Date(lastChecked).toLocaleTimeString()}
              </time>
              . Refreshes every 30 seconds while this tab is visible and no review or wallet action
              is in progress.
            </p>
          )}
          <div className="earn-builder">
            <label>
              USDG amount
              <input
                type="number"
                min="0.000001"
                max="100"
                step="0.000001"
                value={amount}
                disabled={busy}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setPlan(null);
                }}
              />
            </label>
            <MechanicalSwitch
              label="Stock basket"
              description={
                selection === "basket"
                  ? "Split this purchase by your selected percentages."
                  : "Buy one stock with this purchase."
              }
              checked={selection === "basket"}
              disabled={busy}
              onChange={(checked) => {
                setSelection(checked ? "basket" : "NVDA");
                setPlan(null);
              }}
            />
            {selection !== "basket" && (
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
                  {ENABLED_STOCKS.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selection === "basket" && (
              <div className="pilot-weights">
                {ENABLED_STOCKS.map((s) => (
                  <label key={s.symbol}>
                    {s.symbol} %
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={weights[s.symbol]}
                      disabled={busy}
                      onChange={(e) => {
                        setWeights((v) => ({
                          ...v,
                          [s.symbol]: Number(e.target.value),
                        }));
                        setPlan(null);
                      }}
                    />
                  </label>
                ))}
                <p>
                  Total: {Object.values(weights).reduce((sum, value) => sum + value, 0)}% · must
                  equal 100%.
                </p>
              </div>
            )}
            <p className="earn-small">
              Deposit: approve the exact amount, then deposit. Convert or reserve: enter an amount
              no larger than available gains. Withdrawal always returns the full remaining account
              value.
            </p>
            <div className="live-actions">
              {[
                ["approve", "1. Approve USDG"],
                ["deposit", "2. Deposit"],
                ["harvest", "Buy stocks with gains"],
                ["compound", "Reserve gains as principal"],
                ["withdraw", "Withdraw all"],
              ].map(([action, label]) => (
                <button
                  key={action}
                  className="earn-button"
                  disabled={
                    busy ||
                    !!pending ||
                    !!journal ||
                    (action !== "withdraw" && (!enabled || !acknowledged))
                  }
                  onClick={() => void act(() => prepare(action))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      {plan && (
        <div className="live-result" aria-live="polite">
          <span className="earn-eyebrow">REVIEW BEFORE YOUR WALLET OPENS</span>
          <strong>
            {plan.action === "deploy" ? "Create your lending account" : `${fmt(plan.assets)} USDG`}
          </strong>
          <p>{plan.summary}</p>
          {plan.purchases?.map((p) => (
            <p key={p.symbol}>
              {fmt(p.amountIn)} USDG → at least {fmt(p.minimumOut, 18)} {p.symbol} tokens.
            </p>
          ))}
          <p>
            Estimated gas allowance: {fmt(plan.estimatedGasCostWei, 18)} ETH, including a 20%
            gas-limit buffer. Your wallet shows the final fee. ETH gas is separate from USDG gains.
          </p>
          {!plan.hasGasBalance && (
            <p className="earn-warning">Your wallet needs more ETH for the estimated gas.</p>
          )}
          <small>
            Preview expires {new Date(plan.expiresAt).toLocaleTimeString()}. Review all details in
            your wallet.
          </small>
          <button
            className="earn-button"
            disabled={
              busy ||
              !!journal ||
              !plan.canSubmit ||
              now >= Date.parse(plan.expiresAt) ||
              (plan.action !== "withdraw" && (!enabled || !acknowledged))
            }
            onClick={() => void act(send)}
          >
            {now >= Date.parse(plan.expiresAt)
              ? "Preview expired — review again"
              : "Approve in my wallet"}
            <ArrowUpRight size={16} />
          </button>
        </div>
      )}
      {journal && !journal.hash && (
        <div className="live-result" aria-live="polite">
          <strong>Wallet request still needs reconciliation</strong>
          <p>
            The wallet may still be awaiting approval, or its response was interrupted. Check wallet
            activity before doing anything else. No automatic retry will occur.
          </p>
        </div>
      )}
      {(pending || journal) && (
        <div className="live-result">
          <label>
            Recovery transaction hash
            <input
              value={recoveryHash}
              onChange={(e) => setRecoveryHash(e.target.value)}
              placeholder="Paste the submitted, sped-up or cancellation transaction hash"
              disabled={busy}
            />
          </label>
          <button
            className="earn-button"
            disabled={busy || !recoveryHash}
            onClick={() => void act(() => confirm(recoveryHash, false))}
          >
            Verify recovery transaction
          </button>
          <p className="earn-small">
            Recovery checks the sender and original wallet nonce. Pending references are saved only
            in this browser. Account values and confirmation always come from the chain.
          </p>
        </div>
      )}
      {pending && (
        <div className="live-result" aria-live="polite">
          <strong>Transaction submitted — awaiting confirmation</strong>
          <a
            className="earn-link"
            href={`${EXPLORER_URL}/tx/${pending}`}
            target="_blank"
            rel="noreferrer"
          >
            View wallet transaction <ArrowUpRight size={14} />
          </a>
          <button
            className="earn-button"
            disabled={busy}
            onClick={() => void act(() => confirm(pending, false))}
          >
            Check confirmation
          </button>
          <p>Do not repeat this action while it is pending.</p>
        </div>
      )}
      {receipt?.status === "confirmed" && (
        <div className="live-result" aria-live="polite">
          <strong>Confirmed on Robinhood Chain</strong>
          {receipt.events?.map((e, i) => (
            <p key={i}>
              {e.name === "StockPurchased"
                ? `${fmt(e.assetAmount)} USDG bought ${fmt(e.tokenAmount!, 18)} ${ENABLED_STOCKS.find((s) => s.address.toLowerCase() === e.token?.toLowerCase())?.symbol ?? "Stock"} tokens.`
                : `${e.name}: ${fmt(e.assetAmount)} USDG.`}
            </p>
          ))}
          <a
            className="earn-link"
            href={`${EXPLORER_URL}/tx/${receipt.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            View confirmed transaction <ArrowUpRight size={14} />
          </a>
        </div>
      )}
      {busy && <p aria-live="polite">Checking the chain or waiting for your wallet…</p>}
      {error && (
        <p className="earn-warning" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
