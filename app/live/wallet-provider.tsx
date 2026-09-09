'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { hexlify, toUtf8Bytes } from 'ethers';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../../components/ui/dialog';
import { WalletConnectButton } from './wallet-connect-button';
import { CHAIN_ID, EXPLORER_URL, RPC_URL } from '../../lib/live/config';
import {
  createWalletRequestGate,
  dashboardRecoveryPath,
  mergeDiscoveredWallet,
  readWalletIdentity,
  type BrowserWalletProvider,
  type DiscoveredWallet,
} from './wallet-connection';
import './wallet-provider.css';
type Identity = { owner: string; network: number };
type WalletConnection = {
  owner: string | null;
  network: number | null;
  selected: DiscoveredWallet | null;
  providers: DiscoveredWallet[];
  busy: boolean;
  error: string;
  requestConnect: () => void;
  refreshConnection: () => Promise<Identity | undefined>;
  switchNetwork: () => Promise<void>;
  confirmOwnership: () => Promise<void>;
  disconnect: () => Promise<void>;
};
const WalletContext = createContext<WalletConnection | null>(null);
export function useWalletConnection() {
  const value = useContext(WalletContext);
  if (!value)
    throw Error(
      'WalletProvider must wrap the app before using wallet connection.',
    );
  return value;
}
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [providers, setProviders] = useState<DiscoveredWallet[]>([]);
  const [selected, setSelected] = useState<DiscoveredWallet | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [discoveryReady, setDiscoveryReady] = useState(false);
  const gate = useRef(createWalletRequestGate());
  const generation = useRef(0);
  const dialogGeneration = useRef(0);
  const selectedProvider = useRef<BrowserWalletProvider | null>(null);
  const mounted = useRef(true);
  const resumed = useRef(false);
  const discover = useCallback(() => {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const fallback = (window as Window & { ethereum?: BrowserWalletProvider })
      .ethereum;
    if (fallback?.request)
      setProviders((all) =>
        mergeDiscoveredWallet(all, {
          info: { uuid: 'injected', name: 'Browser wallet', rdns: 'injected' },
          provider: fallback,
        }),
      );
  }, []);
  useEffect(() => {
    mounted.current = true;
    const announced = (event: Event) => {
      const wallet = (event as CustomEvent<DiscoveredWallet>).detail;
      if (!wallet?.provider?.request || !wallet.info?.uuid) return;
      setProviders((all) => mergeDiscoveredWallet(all, wallet));
    };
    window.addEventListener('eip6963:announceProvider', announced);
    // Discovery never requests accounts or opens a wallet prompt.
    const discovery = window.setTimeout(discover, 0);
    const invalidate = () => {
      generation.current++;
    };
    const timer = window.setTimeout(() => setDiscoveryReady(true), 200);
    return () => {
      mounted.current = false;
      invalidate();
      window.clearTimeout(discovery);
      window.clearTimeout(timer);
      window.removeEventListener('eip6963:announceProvider', announced);
    };
  }, [discover]);
  useEffect(() => {
    if (!selected) return;
    const reset = () => {
      generation.current++;
      setIdentity(null);
      setError(
        'Wallet account or network changed. Connect again to refresh the exact account.',
      );
    };
    selected.provider.on?.('accountsChanged', reset);
    selected.provider.on?.('chainChanged', reset);
    return () => {
      selected.provider.removeListener?.('accountsChanged', reset);
      selected.provider.removeListener?.('chainChanged', reset);
    };
  }, [selected]);
  const readCurrent = useCallback(async (provider: BrowserWalletProvider) => {
    const version = ++generation.current;
    const value = await readWalletIdentity(provider);
    if (
      !mounted.current ||
      version !== generation.current ||
      selectedProvider.current !== provider
    )
      return undefined;
    setIdentity(value);
    return value;
  }, []);
  useEffect(() => {
    if (resumed.current || !providers.length) return;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem('freestock-wallet-provider');
    } catch {
      /* Optional hint only. */
    }
    const candidate = providers.find((p) => p.info.rdns === saved);
    if (!candidate) return;
    resumed.current = true;
    // Resume an already-authorized provider without opening any wallet prompt.
    selectedProvider.current = candidate.provider;
    // Synchronize the remembered external wallet once, without prompting.
    // oxlint-disable-next-line react/react-compiler
    setSelected(candidate);
    void readCurrent(candidate.provider).catch(() => {
      /* The connect button remains available. */
    });
  }, [providers, readCurrent]);
  const authenticate = useCallback(
    async (provider: BrowserWalletProvider, current: Identity) => {
      if (current.network !== CHAIN_ID) return;
      const sessionResponse = await fetch('/api/auth/session', {
        cache: 'no-store',
      });
      if (!sessionResponse.ok)
        throw Error('Could not check your wallet connection. Please retry.');
      const session = (await sessionResponse.json()) as {
        wallet?: string | null;
      };
      if (session.wallet?.toLowerCase() === current.owner.toLowerCase()) {
        window.dispatchEvent(new Event('freestock:wallet-auth'));
        return;
      }
      const response = await fetch('/api/auth/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: current.owner }),
      });
      const challenge = (await response.json()) as {
        id: string;
        message: string;
        wallet: string;
        chainId: number;
        error?: string;
      };
      if (!response.ok)
        throw Error(
          challenge.error ?? 'Could not prepare wallet confirmation.',
        );
      const lines =
        typeof challenge.message === 'string'
          ? challenge.message.split('\n')
          : [];
      const issued = Date.parse(lines[9]?.replace('Issued At: ', '')),
        expires = Date.parse(lines[10]?.replace('Expiration Time: ', ''));
      if (
        !/^[a-f0-9]{64}$/.test(challenge.id) ||
        challenge.chainId !== CHAIN_ID ||
        challenge.wallet.toLowerCase() !== current.owner.toLowerCase() ||
        lines.length !== 11 ||
        lines[0] !==
          `${location.host} wants you to sign in with your Ethereum account:` ||
        lines[1].toLowerCase() !== current.owner.toLowerCase() ||
        lines[2] !== '' ||
        lines[3] !==
          'Create or access your Freestock profile. This free signature does not move funds or approve spending.' ||
        lines[4] !== '' ||
        lines[5] !== `URI: ${location.origin}/dashboard` ||
        lines[6] !== 'Version: 1' ||
        lines[7] !== `Chain ID: ${CHAIN_ID}` ||
        !/^Nonce: [a-f0-9]{64}$/.test(lines[8]) ||
        !Number.isFinite(issued) ||
        !Number.isFinite(expires) ||
        issued > Date.now() + 60000 ||
        expires <= Date.now() ||
        expires - issued !== 300000
      )
        throw Error(
          'The wallet confirmation did not match this website. Please retry.',
        );
      const before = await readCurrent(provider);
      if (
        !before ||
        before.owner.toLowerCase() !== current.owner.toLowerCase() ||
        before.network !== CHAIN_ID
      )
        throw Error(
          'Your wallet changed. Reconnect before confirming ownership.',
        );
      const signature = await provider.request({
        method: 'personal_sign',
        params: [hexlify(toUtf8Bytes(challenge.message)), current.owner],
      });
      const after = await readCurrent(provider);
      if (
        !after ||
        after.owner.toLowerCase() !== current.owner.toLowerCase() ||
        after.network !== CHAIN_ID
      )
        throw Error(
          'Your wallet changed during confirmation. Connect the wallet you want to use again.',
        );
      const verified = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: challenge.id, signature }),
      });
      const result = (await verified.json()) as {
        wallet?: string;
        error?: string;
      };
      if (
        !verified.ok ||
        result.wallet?.toLowerCase() !== current.owner.toLowerCase()
      )
        throw Error(
          result.error ??
            'Wallet ownership could not be confirmed. Please retry.',
        );
      const finalIdentity = await readCurrent(provider);
      if (
        !finalIdentity ||
        finalIdentity.owner.toLowerCase() !== current.owner.toLowerCase() ||
        finalIdentity.network !== CHAIN_ID
      )
        throw Error(
          'Your wallet changed. Reconnect the wallet you want to use.',
        );
      window.dispatchEvent(new Event('freestock:wallet-auth'));
    },
    [readCurrent],
  );
  const run = useCallback(
    async <T,>(operation: () => Promise<T>) =>
      gate.current.run(async () => {
        setBusy(true);
        setError('');
        try {
          return await operation();
        } catch (e) {
          if (mounted.current)
            setError(
              e instanceof Error
                ? e.message
                : 'The wallet request was not completed.',
            );
          return undefined;
        } finally {
          if (mounted.current) setBusy(false);
        }
      }),
    [],
  );
  const goToDashboard = useCallback(() => {
    setOpen(false);
    if (window.location.pathname !== '/dashboard') {
      const params = new URLSearchParams(window.location.search);
      const recovery = new URLSearchParams();
      for (const key of ['deployment', 'transaction']) {
        const value = params.get(key);
        if (value) recovery.set(key, value);
      }
      router.push(dashboardRecoveryPath(recovery.toString()));
    }
  }, [router]);
  const connect = useCallback(
    async (wallet: DiscoveredWallet) => {
      const dialog = dialogGeneration.current;
      await run(async () => {
        generation.current++;
        selectedProvider.current = wallet.provider;
        setSelected(wallet);
        try {
          sessionStorage.setItem('freestock-wallet-provider', wallet.info.rdns);
        } catch {
          /* Optional hint only. */
        }
        setIdentity(null);
        await wallet.provider.request({ method: 'eth_requestAccounts' });
        const value = await readCurrent(wallet.provider);
        if (value && dialog === dialogGeneration.current) {
          goToDashboard();
          await authenticate(wallet.provider, value);
        }
      });
    },
    [authenticate, goToDashboard, readCurrent, run],
  );
  const requestConnect = useCallback(() => {
    if (gate.current.isBusy()) return;
    dialogGeneration.current++;
    setError('');
    setOpen(true);
    discover();
  }, [discover]);
  const refreshConnection = useCallback(async () => {
    if (!selected) return undefined;
    return run(() => readCurrent(selected.provider));
  }, [readCurrent, run, selected]);
  const switchNetwork = useCallback(async () => {
    if (!selected) return;
    await run(async () => {
      try {
        await selected.provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x1237' }],
        });
      } catch (e) {
        if ((e as { code?: number }).code !== 4902) throw e;
        await selected.provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0x1237',
              chainName: 'Robinhood Chain',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: [EXPLORER_URL],
            },
          ],
        });
      }
      const current = await readCurrent(selected.provider);
      if (current) await authenticate(selected.provider, current);
    });
  }, [authenticate, readCurrent, run, selected]);
  const confirmOwnership = useCallback(async () => {
    if (!selected) return;
    await run(async () => {
      const current = await readCurrent(selected.provider);
      if (current) await authenticate(selected.provider, current);
    });
  }, [authenticate, readCurrent, run, selected]);
  const disconnect = useCallback(async () => {
    await run(async () => {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw Error('Could not disconnect. Please retry.');
      generation.current++;
      selectedProvider.current = null;
      setSelected(null);
      setIdentity(null);
      try {
        sessionStorage.removeItem('freestock-wallet-provider');
      } catch {
        /* Journals stay intact. */
      }
      window.dispatchEvent(new Event('freestock:wallet-auth'));
    });
  }, [run]);
  const value = useMemo(
    () => ({
      owner: identity?.owner ?? null,
      network: identity?.network ?? null,
      selected,
      providers,
      busy,
      error,
      requestConnect,
      refreshConnection,
      switchNetwork,
      confirmOwnership,
      disconnect,
    }),
    [
      identity,
      selected,
      providers,
      busy,
      error,
      requestConnect,
      refreshConnection,
      switchNetwork,
      confirmOwnership,
      disconnect,
    ],
  );
  return (
    <WalletContext.Provider value={value}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) dialogGeneration.current++;
          setOpen(next);
        }}
      >
        <DialogContent className="wallet-choose-dialog" showCloseButton={false}>
          <div className="earn wallet-dialog-content">
            <div className="wallet-dialog-heading">
              <DialogTitle>Connect your wallet</DialogTitle>
              <button
                type="button"
                className="wallet-dialog-close"
                aria-label="Close wallet selection"
                onClick={() => {
                  dialogGeneration.current++;
                  setOpen(false);
                }}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <DialogDescription>
              Choose your wallet, then confirm a free ownership message to
              create or access your Freestock profile. No funds move during
              connection.
            </DialogDescription>
            {identity && (
              <div className="wallet-dialog-connected">
                <strong>{selected?.info.name}</strong>
                <code>{identity.owner}</code>
                <span>
                  {identity.network === CHAIN_ID
                    ? 'Robinhood Chain'
                    : 'Switch to Robinhood Chain on your dashboard'}
                </span>
                <button
                  type="button"
                  className="earn-link"
                  disabled={busy}
                  onClick={goToDashboard}
                >
                  Open my dashboard
                </button>
              </div>
            )}
            {!providers.length ? (
              <div className="wallet-dialog-empty">
                <p>
                  {discoveryReady
                    ? 'No browser wallet was detected. Install an Ethereum wallet extension, or open freestock in your wallet’s browser.'
                    : 'Looking for installed wallets…'}
                </p>
                <button type="button" className="earn-link" onClick={discover}>
                  Check for wallets again
                </button>
              </div>
            ) : (
              <div className="wallet-dialog-options">
                {providers.map((wallet) => (
                  <WalletConnectButton
                    key={wallet.info.uuid}
                    walletName={wallet.info.name}
                    reconnect={
                      wallet.provider === selected?.provider && !!identity
                    }
                    disabled={busy}
                    onClick={() => {
                      if (identity && wallet.provider === selected?.provider)
                        goToDashboard();
                      else void connect(wallet);
                    }}
                    label={
                      identity && wallet.provider === selected?.provider
                        ? 'Use this wallet'
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
            {busy && <p aria-live="polite">Waiting for your wallet…</p>}
            {error && (
              <p className="earn-warning" role="alert">
                {error}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </WalletContext.Provider>
  );
}
