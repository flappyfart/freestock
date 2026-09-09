'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import Link from 'next/link';
import { formatUnits } from 'ethers';
import {
  ArrowUpRight,
  Check,
  RefreshCw,
  LayoutDashboard,
  Wallet,
  Layers3,
  SlidersHorizontal,
  BookOpen,
  ChevronRight,
  ScanLine,
  History,
} from 'lucide-react';
import { requiresSessionReset } from '../../lib/live/pilot-access';
import { readJournal, JOURNAL_EVENT } from '../../lib/live/wallet-journal';
import PilotWorkspace, { type PilotAvailability } from './pilot-workspace';
import { WalletConnectButton } from './wallet-connect-button';
import { useWalletConnection } from './wallet-provider';
import { EarnShell } from '../earn-shell';
import { StockLendingMarkets } from '../stock-lending-markets';
import { MarketDirectory } from '../market-directory';
import { CHAIN_ID, EXPLORER_URL, STOCK_TOKENS } from '../../lib/live/config';
import { AgenticLending } from './agentic-lending';
import { PurchaseAlerts } from './purchase-alerts';
import { PortfolioHistory } from './portfolio-history';
import {
  type AgentIntent,
  type PilotReadState,
  validateAgentIntent,
} from '../../lib/live/agentic-lending';
import './live-workspace.css';
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
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals === 18 ? 6 : 4,
  }).format(n);
};
type DashboardView =
  | 'overview'
  | 'position'
  | 'agentic'
  | 'activity'
  | 'markets'
  | 'advanced';
const dashboardSections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'position', label: 'Your position', icon: Wallet },
  { id: 'agentic', label: 'Agentic Lending', icon: ScanLine },
  { id: 'activity', label: 'Activity', icon: History },
  { id: 'markets', label: 'Market explorer', icon: Layers3 },
  { id: 'advanced', label: 'Advanced tools', icon: SlidersHorizontal },
] as const;
const dashboardCopy: Record<
  DashboardView,
  { title: string; description: string }
> = {
  overview: {
    title: 'Overview',
    description: 'Your wallet, lending position and next step.',
  },
  position: {
    title: 'Your position',
    description: 'Manage your USDG lending account.',
  },
  activity: {
    title: 'Portfolio activity',
    description: 'Your saved positions and verified transaction history.',
  },
  agentic: {
    title: 'Agentic Lending',
    description: 'Your lending plan. A reason for every next move.',
  },
  markets: {
    title: 'Market explorer',
    description: 'Follow the lending markets. These feeds are read-only.',
  },
  advanced: {
    title: 'Advanced tools',
    description:
      'Inspect wallet balances and test a route without moving funds.',
  },
};
export default function LiveWorkspace({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const wallet = useWalletConnection();
  const {
    owner: connected,
    selected,
    network,
    requestConnect,
    switchNetwork,
  } = wallet;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [reading, setReading] = useState(false),
    [working, setWorking] = useState(false),
    [snapshotError, setSnapshotError] = useState(''),
    [checkError, setCheckError] = useState(''),
    [input, setInput] = useState('10'),
    [symbol, setSymbol] = useState('NVDA'),
    [quote, setQuote] = useState<Quote | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [availability, setAvailability] = useState<PilotAvailability>('loading'),
    [chainHealth, setChainHealth] = useState<{
      available: boolean;
      message?: string;
    } | null>(null),
    [availabilityAttempt, setAvailabilityAttempt] = useState(0),
    [snapshotAttempt, setSnapshotAttempt] = useState(0);
  const [authenticatedWallet, setAuthenticatedWallet] = useState<string | null>(
    null,
  );
  const authenticated =
    !!connected &&
    authenticatedWallet?.toLowerCase() === connected.toLowerCase();
  const sessionScope = useRef<string | null | undefined>(undefined);
  const generation = useRef(0),
    requestInFlight = useRef(false);
  const busy = wallet.busy || reading || working;
  const currentSnapshot =
    network === CHAIN_ID &&
    snapshot?.address.toLowerCase() === connected?.toLowerCase()
      ? snapshot
      : null;
  useEffect(() => {
    const controller = new AbortController();
    let checking = false;
    let queued = false;
    let requestVersion = 0;
    async function refreshAccess() {
      if (document.hidden || controller.signal.aborted) return;
      const version = ++requestVersion;
      if (checking) {
        queued = true;
        return;
      }
      checking = true;
      setAvailability('loading');
      try {
        const response = await fetch('/api/live/status', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw Error('Availability check failed.');
        const value = (await response.json()) as {
          walletTransactionsEnabled?: unknown;
          sessionScope?: unknown;
          authenticatedWallet?: unknown;
          chainHealth?: { available?: unknown; message?: unknown };
        };
        if (
          typeof value.walletTransactionsEnabled !== 'boolean' ||
          !(
            value.authenticatedWallet === null ||
            (typeof value.authenticatedWallet === 'string' &&
              /^0x[a-fA-F0-9]{40}$/.test(value.authenticatedWallet))
          ) ||
          typeof value.chainHealth?.available !== 'boolean' ||
          !(
            value.sessionScope === null ||
            (typeof value.sessionScope === 'string' &&
              /^[a-f0-9]{64}$/.test(value.sessionScope))
          ) ||
          value.walletTransactionsEnabled !== (value.sessionScope !== null)
        )
          throw Error('Invalid availability.');
        if (controller.signal.aborted || version !== requestVersion) return;
        if (requiresSessionReset(sessionScope.current, value.sessionScope)) {
          // Clear profile data and reviews; the wallet journal survives for recovery.
          window.location.reload();
          return;
        }
        sessionScope.current = value.sessionScope;
        setAuthenticatedWallet(value.authenticatedWallet as string | null);
        setAvailability(
          value.walletTransactionsEnabled ? 'enabled' : 'unavailable',
        );
        setChainHealth({
          available: value.chainHealth.available,
          message:
            typeof value.chainHealth.message === 'string'
              ? value.chainHealth.message
              : undefined,
        });
      } catch {
        if (!controller.signal.aborted && version === requestVersion) {
          setAvailability('error');
          setChainHealth(null);
        }
      } finally {
        checking = false;
        if (queued) {
          queued = false;
          void refreshAccess();
        }
      }
    }
    void refreshAccess();
    const refresh = () => {
      void refreshAccess();
    };
    window.addEventListener('freestock:wallet-auth', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      window.removeEventListener('freestock:wallet-auth', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [availabilityAttempt]);
  useEffect(() => {
    const version = ++generation.current;
    const controller = new AbortController();
    // Discard read-only plans as soon as their wallet identity changes.
    // oxlint-disable-next-line react/react-compiler
    setQuote(null);
    setPreview(null);
    setSnapshotError('');
    setCheckError('');
    if (!authenticated || !connected || network !== CHAIN_ID) {
      setReading(false);
      return () => controller.abort();
    }
    setReading(true);
    void fetch(`/api/live/wallet?address=${encodeURIComponent(connected)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const value = (await response.json()) as Snapshot & { error?: string };
        if (!response.ok)
          throw Error(value.error ?? 'Could not read this wallet.');
        if (value.address?.toLowerCase() !== connected.toLowerCase())
          throw Error(
            'The wallet response did not match the connected account.',
          );
        if (!controller.signal.aborted && version === generation.current)
          setSnapshot(value);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted && version === generation.current)
          setSnapshotError(
            e instanceof Error
              ? e.message
              : 'Could not refresh wallet balances.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted && version === generation.current)
          setReading(false);
      });
    return () => {
      controller.abort();
    };
  }, [authenticated, connected, network, snapshotAttempt]);
  async function act(operation: () => Promise<void>) {
    if (requestInFlight.current || wallet.busy) return;
    requestInFlight.current = true;
    const version = generation.current;
    setWorking(true);
    setCheckError('');
    try {
      await operation();
    } catch (e) {
      if (version === generation.current)
        setCheckError(
          e instanceof Error ? e.message : 'This check could not be completed.',
        );
    } finally {
      requestInFlight.current = false;
      setWorking(false);
    }
  }
  async function checkQuote() {
    const id = generation.current;
    setQuote(null);
    const r = await fetch(
      `/api/live/quote?symbol=${symbol}&amount=${encodeURIComponent(input)}`,
    );
    const data = (await r.json()) as Quote & { error?: string };
    if (!r.ok) throw Error(data.error ?? 'No quote available.');
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
    if (!r.ok) throw Error(data.error ?? 'Deposit preview unavailable.');
    if (id === generation.current) setPreview(data);
  }
  const workspaceId = useId();
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const [view, setView] = useState<DashboardView>('overview');
  const [pilotState, setPilotState] = useState<PilotReadState | null>(null);
  const [agentIntent, setAgentIntent] = useState<AgentIntent | null>(null);
  const pilotScope = `${selected?.info.uuid ?? 'none'}:${connected?.toLowerCase() ?? 'none'}:${network ?? 'none'}`;
  const activePilot = pilotState?.scope === pilotScope ? pilotState : null;
  const intentHandled = useCallback(
    (id: string) =>
      setAgentIntent((current) => (current?.id === id ? null : current)),
    [],
  );
  useEffect(() => {
    const followView = () => {
      const target = new URLSearchParams(window.location.search).get('view');
      if (dashboardSections.some((s) => s.id === target))
        setView(target as DashboardView);
    };
    followView();
    window.addEventListener('popstate', followView);
    return () => window.removeEventListener('popstate', followView);
  }, []);
  const [recoveryOwner, setRecoveryOwner] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (!connected) return;
    const inspect = () => {
      try {
        const saved = readJournal(connected);
        const pendingReference = new URLSearchParams(
          window.location.search,
        ).get('transaction');
        if (saved || pendingReference) setView('position');
        setRecoveryOwner(saved ? connected : null);
      } catch {
        // A damaged journal remains locked by the existing wallet submission path.
        setRecoveryOwner(connected);
      }
    };
    // Connecting opens the position; a URL receipt alone must not lock navigation after recovery.
    // oxlint-disable-next-line react/react-compiler -- Synchronize navigation with a newly connected wallet.
    setView(
      ['agentic', 'activity'].includes(
        new URLSearchParams(window.location.search).get('view') ?? '',
      )
        ? (new URLSearchParams(window.location.search).get(
            'view',
          ) as DashboardView)
        : 'position',
    );
    inspect();
    window.addEventListener(JOURNAL_EVENT, inspect);
    window.addEventListener('storage', inspect);
    return () => {
      window.removeEventListener(JOURNAL_EVENT, inspect);
      window.removeEventListener('storage', inspect);
    };
  }, [connected]);
  const hasRecovery = !!connected && recoveryOwner === connected;
  const currentView: DashboardView = hasRecovery ? 'position' : view;
  const connectionVisible =
    currentView === 'overview' || currentView === 'position';
  const positionVisible = currentView === 'position';
  const Heading = embedded ? 'h2' : 'h1';
  const section = dashboardCopy[currentView];
  const walletReady =
    authenticated && !!connected && !!selected && network === CHAIN_ID;
  const needsSetup = !walletReady && currentView !== 'markets';

  const retryAccess = () => setAvailabilityAttempt((value) => value + 1);
  function navigate(next: DashboardView) {
    if (hasRecovery && next !== 'position') return;
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set('view', next);
    window.history.replaceState(null, '', url);
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }
  const content = (
    <div
      className={`${embedded ? '' : 'earn-wrap '}live-workspace dashboard-workspace dashboard-shell`}
    >
      <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
        <div className="dashboard-sidebar-heading">
          <LayoutDashboard size={19} aria-hidden="true" />
          <strong>Workspace</strong>
        </div>
        <nav aria-label="Dashboard sections">
          {dashboardSections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                aria-current={currentView === item.id ? 'page' : undefined}
                aria-controls={`${workspaceId}-content`}
                disabled={hasRecovery && item.id !== 'position'}
                onClick={() => navigate(item.id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>
                  {item.id === 'position' && !activePilot?.account
                    ? 'Create position'
                    : item.label}
                </span>
                <ChevronRight
                  size={14}
                  className="dashboard-nav-chevron"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </nav>
        <div className="dashboard-sidebar-footer">
          <p>Every transaction needs your wallet approval.</p>
          <Link href="/learn">
            <BookOpen size={16} aria-hidden="true" /> Learn how it works
          </Link>
          <Link href="/docs">
            Product documentation <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </aside>
      <div className="dashboard-main" id={`${workspaceId}-content`}>
        {walletReady && (
          <PurchaseAlerts
            key={pilotScope}
            owner={connected!}
            blocked={hasRecovery}
            onPlan={(alert) => {
              if (hasRecovery) return;
              if (
                alert &&
                activePilot?.account?.account.toLowerCase() !==
                  alert.account.toLowerCase()
              ) {
                window.location.assign(
                  `/dashboard?view=agentic&deployment=${encodeURIComponent(alert.deployment)}`,
                );
              } else {
                window.dispatchEvent(new Event('freestock:open-agent-plan'));
                navigate('agentic');
              }
            }}
          />
        )}
        <button
          type="button"
          className="dashboard-mobile-menu"
          onClick={() => setSectionMenuOpen(true)}
          aria-expanded={sectionMenuOpen}
        >
          <LayoutDashboard size={18} />
          {section.title}
          <ChevronRight size={17} />
        </button>
        <Dialog open={sectionMenuOpen} onOpenChange={setSectionMenuOpen}>
          <DialogContent className="mobile-menu-dialog">
            <DialogTitle>Your workspace</DialogTitle>
            <DialogDescription>Choose where to go.</DialogDescription>
            <nav aria-label="Mobile dashboard sections">
              {dashboardSections.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-current={currentView === item.id ? 'page' : undefined}
                  disabled={hasRecovery && item.id !== 'position'}
                  onClick={() => {
                    navigate(item.id);
                    setSectionMenuOpen(false);
                  }}
                >
                  {item.label}
                  <ChevronRight size={16} />
                </button>
              ))}
            </nav>
          </DialogContent>
        </Dialog>

        <header
          className="dashboard-page-heading"
          hidden={positionVisible && walletReady}
        >
          <div>
            <Heading ref={headingRef} tabIndex={-1}>
              {section.title}
            </Heading>
            <p>{section.description}</p>
          </div>
          {connected && !connectionVisible && (
            <button
              type="button"
              className="dashboard-wallet-short"
              disabled={wallet.busy}
              onClick={requestConnect}
              aria-label={`Change connected wallet ${connected}`}
            >
              <Wallet size={16} aria-hidden="true" />
              {connected.slice(0, 6)}…{connected.slice(-4)}
            </button>
          )}
        </header>

        {hasRecovery && (
          <output className="dashboard-notice dashboard-recovery-notice">
            A wallet request needs attention. Resolve it in your position before
            switching dashboard sections.
          </output>
        )}
        {chainHealth?.available === false && (
          <output className="dashboard-notice">
            <span>
              {chainHealth.message ||
                'The network connection is temporarily unavailable.'}{' '}
              Wallet balances and transaction checks may be delayed.
            </span>
            <button
              type="button"
              className="earn-link"
              onClick={() => {
                setAvailability('loading');
                setChainHealth(null);
                setAvailabilityAttempt((value) => value + 1);
              }}
            >
              Retry network connection{' '}
              <RefreshCw size={14} aria-hidden="true" />
            </button>
          </output>
        )}
        {wallet.error && (
          <p className="dashboard-notice" role="alert">
            {wallet.error}
          </p>
        )}

        {needsSetup && (
          <section
            className="dashboard-onboarding"
            aria-label="Get started"
            aria-live="polite"
          >
            <ol className="onboarding-progress" aria-label="Setup progress">
              <li data-complete={authenticated} aria-current="step">
                <span>{authenticated ? <Check size={16} /> : '1'}</span>Connect
                wallet
              </li>
              <li>
                <span>2</span>Create position
              </li>
              <li>
                <span>3</span>Add USDG
              </li>
              <li>
                <span>4</span>Choose stock picks
              </li>
            </ol>
            <div className="onboarding-body">
              <div className="onboarding-symbol">
                <Wallet size={28} />
              </div>
              <h2>
                {!connected
                  ? hasRecovery
                    ? 'Reconnect to resume your position'
                    : 'Your wallet is your Freestock account'
                  : network !== CHAIN_ID
                    ? 'Switch to Robinhood Chain'
                    : wallet.busy
                      ? 'Confirm the free message in your wallet'
                      : 'One confirmation, then you’re in'}
              </h2>
              <p>
                {!connected
                  ? 'Connect your wallet and confirm a free ownership message. We’ll find your existing positions or walk you through creating your first one.'
                  : network !== CHAIN_ID
                    ? 'Your position runs on Robinhood Chain. Confirm the network switch to continue.'
                    : 'This signature creates or unlocks your Freestock profile. It costs no gas, moves no money, and gives no permission to spend your tokens.'}
              </p>
              {connected && (
                <p className="onboarding-connected">
                  <Check size={16} /> {connected.slice(0, 6)}…
                  {connected.slice(-4)}
                </p>
              )}
              {!connected ? (
                <WalletConnectButton
                  walletName="Choose a wallet"
                  disabled={wallet.busy}
                  onClick={requestConnect}
                />
              ) : network !== CHAIN_ID ? (
                <button
                  type="button"
                  className="dashboard-button"
                  disabled={wallet.busy}
                  onClick={() => void switchNetwork()}
                >
                  Switch network <ArrowUpRight size={17} />
                </button>
              ) : (
                <button
                  type="button"
                  className="dashboard-button"
                  disabled={wallet.busy}
                  onClick={() => void wallet.confirmOwnership()}
                >
                  {wallet.busy
                    ? 'Waiting for your wallet…'
                    : 'Confirm wallet ownership'}
                  <ArrowUpRight size={17} />
                </button>
              )}
              <p className="onboarding-note">
                Next, we’ll check for saved positions. You’ll need USDG to lend
                and a little ETH for network fees.
              </p>
            </div>
          </section>
        )}
        {authenticated && availability === 'error' && (
          <p className="dashboard-notice">
            Your wallet session check was interrupted.{' '}
            <button type="button" className="earn-link" onClick={retryAccess}>
              Try again
            </button>
          </p>
        )}
        {walletReady && connectionVisible && (
          <div className="dashboard-wallet-bar">
            <span>
              <Wallet size={17} /> {selected?.info.name}{' '}
              <code>
                {connected!.slice(0, 6)}…{connected!.slice(-4)}
              </code>
            </span>
            <button
              type="button"
              className="earn-link"
              disabled={wallet.busy || hasRecovery}
              onClick={requestConnect}
            >
              Change wallet
            </button>
            <button
              type="button"
              className="earn-link"
              disabled={busy || hasRecovery}
              onClick={() => void wallet.disconnect()}
            >
              Disconnect
            </button>
          </div>
        )}
        {walletReady && snapshotError && currentView === 'advanced' && (
          <p className="dashboard-notice">
            {snapshotError}
            <button
              type="button"
              onClick={() => setSnapshotAttempt((v) => v + 1)}
            >
              Retry balances
            </button>
          </p>
        )}

        {currentView === 'overview' && walletReady && (
          <section
            className="dashboard-overview-next"
            aria-label="Continue in your workspace"
          >
            <p>Manage your USDG position or explore the live market data.</p>
            <div>
              <button
                type="button"
                className="dashboard-button"
                onClick={() => navigate('position')}
              >
                Open your position <ArrowUpRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="dashboard-refresh"
                onClick={() => navigate('agentic')}
              >
                Agentic Lending <ChevronRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="dashboard-refresh"
                onClick={() => navigate('markets')}
              >
                Explore markets <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {/* Keep this exact keyed financial component mounted when changing dashboard sections. */}
        <div
          className="dashboard-position dashboard-view"
          hidden={!positionVisible}
        >
          {authenticated && connected && selected && network === CHAIN_ID && (
            <PilotWorkspace
              key={`${selected.info.uuid}-${connected}`}
              owner={connected}
              provider={selected.provider}
              availability={availability}
              scope={pilotScope}
              onReadState={setPilotState}
              agentIntent={agentIntent}
              onAgentIntentHandled={intentHandled}
              onActivity={() => navigate('activity')}
            />
          )}
        </div>

        <div hidden={currentView !== 'agentic' || !walletReady}>
          <AgenticLending
            key={pilotScope}
            scope={pilotScope}
            active={currentView === 'agentic'}
            owner={connected}
            correctNetwork={network === CHAIN_ID}
            readState={activePilot}
            enabled={availability === 'enabled'}
            onConnect={requestConnect}
            onPosition={() => navigate('position')}
            onReview={(intent) => {
              if (!connected || activePilot?.blocked || readJournal(connected))
                throw Error('Finish the current wallet action first.');
              validateAgentIntent(
                intent,
                pilotScope,
                activePilot?.account ?? null,
                connected,
                Date.now(),
              );
              setAgentIntent(intent);
              navigate('position');
            }}
          />
        </div>

        {currentView === 'activity' && walletReady && (
          <PortfolioHistory
            key={pilotScope}
            owner={connected}
            position={activePilot?.account ?? null}
            onConnect={requestConnect}
            onPosition={() => navigate('position')}
          />
        )}
        {currentView === 'markets' && (
          <section
            className="dashboard-markets dashboard-view"
            aria-label="Read-only market explorer"
          >
            <StockLendingMarkets />
            <MarketDirectory />
          </section>
        )}
        <section
          className="dashboard-advanced dashboard-view"
          hidden={currentView !== 'advanced' || !walletReady}
          aria-label="Read-only wallet balances and route checks"
        >
          <div className="dashboard-advanced-content">
            {currentSnapshot && (
              <section className="earn-section">
                <div className="section-title">
                  <h2>Onchain balances</h2>
                  <span className="earn-pill">
                    <Check size={13} /> Block{' '}
                    {currentSnapshot.block.toLocaleString()}
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
                  Redemption value is a contract preview, not a withdrawal
                  guarantee. Existing vault value is not labeled as earned
                  interest because its original deposit history has not been
                  reconciled here.
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
                  Last checked{' '}
                  {new Date(currentSnapshot.observedAt).toLocaleString()}.
                  Balances refresh on connection or when you request it; public
                  RPC availability can vary.
                </p>
              </section>
            )}

            <section className="earn-builder">
              <h2>Check a real route</h2>
              <p className="earn-small">
                The same amount can preview a vault deposit or a stock purchase.
                These checks do not move money.
              </p>
              <label>
                USDG amount
                <input
                  type="number"
                  disabled={busy}
                  value={input}
                  min="0.000001"
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
                    <option key={s.symbol} disabled={s.symbol === 'MSFT'}>
                      {s.symbol}
                      {s.symbol === 'MSFT' ? ' · direct route unavailable' : ''}
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
                  <span className="earn-eyebrow">
                    UNISWAP V3 · ONCHAIN QUOTE
                  </span>
                  <strong>
                    {format(quote.amountIn)} USDG →{' '}
                    {format(quote.amountOut, 18)} {quote.symbol}
                  </strong>
                  <p>
                    Minimum at 1% slippage: {format(quote.minimumOut, 18)}{' '}
                    tokens. Gas is additional.
                  </p>
                  <small>
                    Block {quote.block.toLocaleString()} · Quote expires{' '}
                    {new Date(quote.expiresAt).toLocaleTimeString()}. Not an
                    executed trade.
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
                    {format(preview.assets)} USDG →{' '}
                    {format(preview.previewShares, 18)} vault shares
                  </strong>
                  <p>
                    {preview.simulation === 'passed'
                      ? 'The exact deposit call simulated successfully at this block.'
                      : preview.simulation === 'needs-balance'
                        ? 'The connected wallet needs more USDG before a deposit can be simulated.'
                        : preview.simulation === 'needs-approval'
                          ? 'A token allowance is needed before the exact deposit can be simulated. No approval has been requested.'
                          : 'The exact deposit call could not be simulated.'}
                  </p>
                  <small>{preview.reason}</small>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </div>
  );
  return embedded ? (
    content
  ) : (
    <EarnShell active="Dashboard">{content}</EarnShell>
  );
}
