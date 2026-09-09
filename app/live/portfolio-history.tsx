'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Download,
  History,
  RefreshCw,
} from 'lucide-react';
import { formatUnits } from 'ethers';
import { EXPLORER_URL } from '../../lib/live/config';
import { ENABLED_STOCKS } from '../../lib/live/basket';
import {
  historyTotals,
  type HistoryRecord,
  type SavedLiveAccount,
} from '../../lib/live/history-model';
import { historyRequest, HISTORY_UPDATED } from '../../lib/live/history-client';
import type { AgentAccount } from '../../lib/live/agentic-lending';
import './portfolio-history.css';
type Page = {
  account: SavedLiveAccount | null;
  records: HistoryRecord[];
  nextOffset: number | null;
  more?: boolean;
};
const labels: Record<string, string> = {
  deploy: 'Account created',
  approve: 'USDG approval',
  deposit: 'USDG deposited',
  withdraw: 'Partial withdrawal',
  withdrawAll: 'Position withdrawn',
  compound: 'Gains reserved',
  harvest: 'Stock purchase',
  cancel: 'Wallet cancellation',
  other: 'Replacement wallet action',
};
const short = (v: string) => `${v.slice(0, 8)}…${v.slice(-6)}`;
const amount = (v: string, d = 6) => formatUnits(v, d);
async function get<T>(path: string, signal: AbortSignal) {
  const response = await fetch(path, { cache: 'no-store', signal }),
    data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw Error(data.error ?? 'Saved activity is unavailable.');
  return data;
}
export function PortfolioHistory({
  owner,
  position,
  onConnect,
  onPosition,
}: {
  owner: string | null;
  position: AgentAccount | null;
  onConnect: () => void;
  onPosition: () => void;
}) {
  const [positions, setPositions] = useState<SavedLiveAccount[]>([]),
    [selected, setSelected] = useState('');
  const [page, setPage] = useState<Page | null>(null),
    [offset, setOffset] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [hash, setHash] = useState(''),
    [replaces, setReplaces] = useState('');
  const controller = useRef<AbortController | null>(null),
    requestId = useRef(0),
    pageRead = useRef(0);
  const current = positions.find((p) => p.account === selected) ?? null;
  const totals = historyTotals(page?.records ?? []);
  const positionAccount = position?.account;
  useEffect(() => {
    const abort = new AbortController();
    let id = 0;
    const load = async () => {
      if (!owner) return;
      const version = ++id;
      try {
        const result = await get<{ accounts: SavedLiveAccount[] }>(
          `/api/live/history?owner=${owner}`,
          abort.signal,
        );
        if (abort.signal.aborted || version !== id) return;
        setPositions(result.accounts);
        setSelected(
          (previous) =>
            previous ||
            (positionAccount &&
            result.accounts.some(
              (p) => p.account === positionAccount.toLowerCase(),
            )
              ? positionAccount.toLowerCase()
              : (result.accounts[0]?.account ?? '')),
        );
      } catch (e) {
        if (!abort.signal.aborted)
          setError(
            e instanceof Error ? e.message : 'Saved positions could not load.',
          );
      }
    };
    void load();
    window.addEventListener(HISTORY_UPDATED, load);
    return () => {
      abort.abort();
      window.removeEventListener(HISTORY_UPDATED, load);
    };
  }, [owner, positionAccount]);
  useEffect(() => {
    if (!owner || !selected) return;
    const abort = new AbortController();
    const load = async () => {
      if (controller.current) return;
      const version = ++pageRead.current;
      try {
        const result = await get<Page>(
          `/api/live/history?owner=${owner}&account=${selected}&offset=${offset}`,
          abort.signal,
        );
        if (!abort.signal.aborted && version === pageRead.current)
          setPage(result);
      } catch (e) {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : 'Activity could not load.');
      }
    };
    void load();
    window.addEventListener(HISTORY_UPDATED, load);
    return () => {
      abort.abort();
      window.removeEventListener(HISTORY_UPDATED, load);
    };
  }, [owner, selected, offset]);
  useEffect(
    () => () => {
      requestId.current++;
      controller.current?.abort();
    },
    [],
  );
  async function sync(importHash?: string) {
    if (!owner || !current || controller.current) return;
    const abort = new AbortController(),
      id = ++requestId.current;
    controller.current = abort;
    pageRead.current++;
    setBusy(true);
    setError('');
    try {
      if (importHash)
        await historyRequest(
          {
            action: 'track',
            owner,
            deployment: current.deployment,
            hash: importHash,
            ...(replaces ? { replaces } : {}),
          },
          abort.signal,
        );
      const result = await historyRequest<Page>(
        { action: 'sync', owner, deployment: current.deployment },
        abort.signal,
      );
      if (id !== requestId.current || abort.signal.aborted) return;
      setOffset(0);
      setPage(result);
      if (importHash) {
        setHash('');
        setReplaces('');
      }
    } catch (e) {
      if (!abort.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : 'History could not sync. Your position is unchanged.',
        );
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
        window.dispatchEvent(new Event(HISTORY_UPDATED));
      }
    }
  }
  if (!owner)
    return (
      <section className="portfolio-empty">
        <History size={28} />
        <h2>Your positions, remembered.</h2>
        <p>
          Connect your wallet to see the positions and verified activity saved
          to your wallet profile.
        </p>
        <button className="dashboard-button" onClick={onConnect}>
          Connect wallet <ArrowUpRight size={16} />
        </button>
      </section>
    );
  if (!current)
    return (
      <section className="portfolio-empty">
        <History size={28} />
        <h2>No saved position yet</h2>
        <p>
          Create or restore your lending account in Your position. Its reference
          will be saved here after verification.
        </p>
        {error && <p role="alert">{error}</p>}
        <button className="dashboard-button" onClick={onPosition}>
          Open your position <ArrowUpRight size={16} />
        </button>
      </section>
    );
  const complete =
    !!page?.account &&
    typeof page.account.syncedBlock === 'number' &&
    page.account.syncedBlock === page.account.headBlock;
  return (
    <section
      className="portfolio-history"
      aria-label="Saved portfolio activity"
    >
      <header className="ph-toolbar">
        <label>
          Saved position
          <select
            value={selected}
            disabled={busy}
            onChange={(e) => {
              setSelected(e.target.value);
              setOffset(0);
              setPage(null);
              setError('');
            }}
          >
            {positions.map((p) => (
              <option key={p.account} value={p.account}>
                {short(p.account)} · Steakhouse USDG
              </option>
            ))}
          </select>
        </label>
        <button
          className="dashboard-button"
          disabled={busy}
          onClick={() => void sync()}
        >
          <RefreshCw size={16} />
          {busy
            ? 'Verifying activity…'
            : page?.account?.syncedBlock && !complete
              ? 'Continue older history'
              : 'Sync from chain'}
        </button>
      </header>
      <div className="ph-coverage">
        <span>
          <span className="ph-status-dot" />
          {complete
            ? 'Saved through last checked block'
            : 'History import in progress'}
        </span>
        <p>
          {page?.account?.syncedBlock
            ? `Verified through block ${page.account.syncedBlock.toLocaleString()}. Records updated ${new Date(page.account.updatedAt).toLocaleString()}.`
            : 'Sync to import confirmed activity from this account’s creation.'}{' '}
          {!complete &&
            'Each sync imports a bounded range. Totals below cover only the records shown.'}{' '}
          Confirmations are checked against the chain; they are not a guarantee
          of finality.
        </p>
      </div>
      {error && (
        <p className="ph-warning" role="alert">
          {error}
        </p>
      )}
      <div className="ph-metrics" aria-label="Amounts on this page">
        <div>
          <span>Deposited · this page</span>
          <strong>
            {page ? amount(totals.deposited) : '—'} <small>USDG</small>
          </strong>
        </div>
        <div>
          <span>Converted to stocks · this page</span>
          <strong>
            {page ? amount(totals.converted) : '—'} <small>USDG</small>
          </strong>
        </div>
        <div>
          <span>Withdrawn · this page</span>
          <strong>
            {page ? amount(totals.withdrawn) : '—'} <small>USDG</small>
          </strong>
        </div>
      </div>
      {totals.stocks.length > 0 && (
        <div className="ph-stock-receipts">
          <h2>Stocks received through this account</h2>
          <p>
            Confirmed purchases on this page. These are received token
            quantities, not your current wallet holdings or investment profit.
          </p>
          <dl>
            {totals.stocks.map((s) => (
              <div key={s.address}>
                <dt>
                  {ENABLED_STOCKS.find(
                    (t) => t.address.toLowerCase() === s.address,
                  )?.symbol ?? 'Stock'}
                </dt>
                <dd>
                  {amount(s.amount, 18)} <small>tokens</small>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <section className="ph-feed">
        <header>
          <div>
            <h2>Activity</h2>
            <p>
              Saved to your wallet profile. Balances always come from fresh
              chain reads.
            </p>
          </div>
          {!!page?.records.length && (
            <a
              className="ph-export"
              href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ chainId: 4663, wallet: owner, account: selected, coverage: page.account, scope: 'This page only', records: page.records }, null, 2))}`}
              download={`freestock-activity-${selected}-${offset}.json`}
            >
              <Download size={15} />
              Export this page
            </a>
          )}
        </header>
        {!page?.records.length ? (
          <div className="ph-no-activity">
            <History size={25} />
            <h3>
              {page
                ? 'No imported transactions yet'
                : 'Loading saved activity…'}
            </h3>
            <p>
              Sync this account to find its deposits, stock purchases and
              withdrawals. You can also import a known transaction below.
            </p>
          </div>
        ) : (
          <ol className="ph-transactions">
            {page.records.map((r) => (
              <li key={r.hash}>
                <div className="ph-transaction-icon">
                  {r.action === 'deposit' ? (
                    <ArrowDownLeft size={20} />
                  ) : r.status === 'confirmed' ? (
                    <Check size={20} />
                  ) : (
                    <History size={20} />
                  )}
                </div>
                <div className="ph-transaction-main">
                  <div className="ph-transaction-title">
                    <h3>{labels[r.action] ?? 'Account action'}</h3>
                    <span className="ph-state" data-state={r.status}>
                      {r.status === 'rechecking'
                        ? 'Needs verification'
                        : r.status}
                    </span>
                  </div>
                  <p className="ph-date">
                    {r.timestamp
                      ? new Date(r.timestamp).toLocaleString()
                      : 'Awaiting a verified confirmation'}
                  </p>
                  {r.status === 'confirmed' &&
                    r.events.map((e) => (
                      <p className="ph-event" key={e.logIndex}>
                        {e.name === 'StockPurchased'
                          ? `${amount(e.assetAmount)} USDG → ${amount(e.tokenAmount!, 18)} ${ENABLED_STOCKS.find((s) => s.address.toLowerCase() === e.token)?.symbol ?? 'Stock'} tokens`
                          : e.name === 'Approval'
                            ? `${amount(e.assetAmount)} USDG approved for this account`
                            : e.name === 'Compounded'
                              ? `${amount(e.assetAmount)} USDG added to the principal baseline`
                              : `${amount(e.assetAmount)} USDG ${e.name === 'Deposited' ? 'deposited' : 'returned to your wallet'}`}
                      </p>
                    ))}
                  {r.status === 'reverted' && (
                    <p>
                      No position changes completed. A network fee may still
                      have been paid.
                    </p>
                  )}
                  {r.replacedBy && (
                    <p>
                      Resolved by{' '}
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`${EXPLORER_URL}/tx/${r.replacedBy}`}
                      >
                        {short(r.replacedBy)}
                      </a>
                      . This original request is not counted as completed.
                    </p>
                  )}
                  <details>
                    <summary>Transaction details</summary>
                    <dl>
                      <div>
                        <dt>Transaction</dt>
                        <dd>
                          <a
                            target="_blank"
                            rel="noreferrer"
                            href={`${EXPLORER_URL}/tx/${r.hash}`}
                          >
                            {short(r.hash)} <ArrowUpRight size={13} />
                          </a>
                        </dd>
                      </div>
                      <div>
                        <dt>Block</dt>
                        <dd>{r.block?.toLocaleString() ?? 'Pending'}</dd>
                      </div>
                      <div>
                        <dt>Execution gas fee</dt>
                        <dd>
                          {r.gasWei
                            ? `${amount(r.gasWei, 18)} ETH`
                            : 'Unavailable'}
                        </dd>
                      </div>
                    </dl>
                    <p>
                      Execution gas is the receipt’s gas used × effective price;
                      other chain fee components may be separate. Records do not
                      prove that all surplus was lending interest.
                    </p>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        )}
        <nav className="ph-pagination" aria-label="Activity pages">
          <button
            disabled={busy || offset === 0}
            onClick={() => {
              setPage(null);
              setOffset(Math.max(0, offset - 50));
            }}
          >
            Previous
          </button>
          <span>Page {Math.floor(offset / 50) + 1}</span>
          <button
            disabled={busy || page?.nextOffset == null}
            onClick={() => {
              const next = page?.nextOffset ?? 0;
              setPage(null);
              setOffset(next);
            }}
          >
            Next
          </button>
        </nav>
      </section>
      <details className="ph-import">
        <summary>Import a transaction or replacement</summary>
        <p>
          Use a transaction sent by this wallet for this position. Only
          chain-verified results are saved; this never resubmits a transaction.
          For a replacement, import the original first.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sync(hash.trim());
          }}
        >
          <label>
            Transaction hash
            <input
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              required
              pattern="0x[0-9a-fA-F]{64}"
              placeholder="0x…"
            />
          </label>
          <label>
            Original hash, if this replaces another request
            <input
              value={replaces}
              onChange={(e) => setReplaces(e.target.value)}
              pattern="0x[0-9a-fA-F]{64}"
              placeholder="Optional"
            />
          </label>
          <button className="dashboard-button" disabled={busy}>
            Verify and save
          </button>
        </form>
      </details>
      <details className="ph-pilot-guide">
        <summary>Your first live run</summary>
        <ol>
          <li>
            <strong>Fund the position.</strong> Review the exact USDG deposit
            and ETH network fee in Your position, then approve it in your
            wallet.
          </li>
          <li>
            <strong>Wait for actual available gains.</strong> Deposited funds
            are not earnings. Direct transfers also create surplus, so they do
            not prove lending income.
          </li>
          <li>
            <strong>Review a stock purchase.</strong> Choose a stock or basket,
            check costs and minimum receipts, then approve the transaction
            yourself.
          </li>
          <li>
            <strong>Verify and withdraw.</strong> Sync the receipts here,
            reconcile the stock quantities, then review a withdrawal in Your
            position.
          </li>
        </ol>
        <button className="dashboard-button" onClick={onPosition}>
          Open your position <ArrowUpRight size={16} />
        </button>
        <p>
          This guide does not execute transactions. Completion requires your
          wallet approvals and actual chain receipts.
        </p>
      </details>
      <p className="ph-footnote">
        Automatic backfill covers successful account events. Known approvals,
        failed requests and replacements can be imported by hash; they are not
        discovered by the account event scan. Donations and token transfers
        elsewhere are outside this history. Pending-request locks remain on the
        browser where you started them.
      </p>
    </section>
  );
}
