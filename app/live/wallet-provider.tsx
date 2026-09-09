"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../components/ui/dialog";
import { WalletConnectButton } from "./wallet-connect-button";
import { CHAIN_ID, EXPLORER_URL, RPC_URL } from "../../lib/live/config";
import {
  createWalletRequestGate,
  dashboardRecoveryPath,
  mergeDiscoveredWallet,
  readWalletIdentity,
  type BrowserWalletProvider,
  type DiscoveredWallet,
} from "./wallet-connection";
import "./wallet-provider.css";
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
};
const WalletContext = createContext<WalletConnection | null>(null);
export function useWalletConnection() {
  const value = useContext(WalletContext);
  if (!value) throw Error("WalletProvider must wrap the app before using wallet connection.");
  return value;
}
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [providers, setProviders] = useState<DiscoveredWallet[]>([]);
  const [selected, setSelected] = useState<DiscoveredWallet | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [discoveryReady, setDiscoveryReady] = useState(false);
  const gate = useRef(createWalletRequestGate());
  const generation = useRef(0);
  const dialogGeneration = useRef(0);
  const selectedProvider = useRef<BrowserWalletProvider | null>(null);
  const mounted = useRef(true);
  const discover = useCallback(() => {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const fallback = (window as Window & { ethereum?: BrowserWalletProvider }).ethereum;
    if (fallback?.request)
      setProviders((all) =>
        mergeDiscoveredWallet(all, {
          info: { uuid: "injected", name: "Browser wallet", rdns: "injected" },
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
    window.addEventListener("eip6963:announceProvider", announced);
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
      window.removeEventListener("eip6963:announceProvider", announced);
    };
  }, [discover]);
  useEffect(() => {
    if (!selected) return;
    const reset = () => {
      generation.current++;
      setIdentity(null);
      setError("Wallet account or network changed. Connect again to refresh the exact account.");
    };
    selected.provider.on?.("accountsChanged", reset);
    selected.provider.on?.("chainChanged", reset);
    return () => {
      selected.provider.removeListener?.("accountsChanged", reset);
      selected.provider.removeListener?.("chainChanged", reset);
    };
  }, [selected]);
  const readCurrent = useCallback(async (provider: BrowserWalletProvider) => {
    const version = ++generation.current;
    const value = await readWalletIdentity(provider);
    if (!mounted.current || version !== generation.current || selectedProvider.current !== provider)
      return undefined;
    setIdentity(value);
    return value;
  }, []);
  const run = useCallback(
    async <T,>(operation: () => Promise<T>) =>
      gate.current.run(async () => {
        setBusy(true);
        setError("");
        try {
          return await operation();
        } catch (e) {
          if (mounted.current)
            setError(e instanceof Error ? e.message : "The wallet request was not completed.");
          return undefined;
        } finally {
          if (mounted.current) setBusy(false);
        }
      }),
    [],
  );
  const goToDashboard = useCallback(() => {
    setOpen(false);
    if (window.location.pathname !== "/dashboard") {
      const params = new URLSearchParams(window.location.search);
      const recovery = new URLSearchParams();
      for (const key of ["deployment", "transaction"]) {
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
        setIdentity(null);
        await wallet.provider.request({ method: "eth_requestAccounts" });
        const value = await readCurrent(wallet.provider);
        if (value && dialog === dialogGeneration.current) goToDashboard();
      });
    },
    [goToDashboard, readCurrent, run],
  );
  const requestConnect = useCallback(() => {
    if (gate.current.isBusy()) return;
    dialogGeneration.current++;
    setError("");
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
      await readCurrent(selected.provider);
    });
  }, [readCurrent, run, selected]);
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
    }),
    [identity, selected, providers, busy, error, requestConnect, refreshConnection, switchNetwork],
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
              Choose an installed wallet. Connection shares your address; it does not approve tokens
              or send funds.
            </DialogDescription>
            {identity && (
              <div className="wallet-dialog-connected">
                <strong>{selected?.info.name}</strong>
                <code>{identity.owner}</code>
                <span>
                  {identity.network === CHAIN_ID
                    ? "Robinhood Chain"
                    : "Switch to Robinhood Chain on your dashboard"}
                </span>
                <button type="button" className="earn-link" disabled={busy} onClick={goToDashboard}>
                  Open my dashboard
                </button>
              </div>
            )}
            {!providers.length ? (
              <div className="wallet-dialog-empty">
                <p>
                  {discoveryReady
                    ? "No browser wallet was detected. Install an Ethereum wallet extension, or open freestock in your wallet’s browser."
                    : "Looking for installed wallets…"}
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
                    reconnect={wallet.provider === selected?.provider && !!identity}
                    disabled={busy}
                    onClick={() => {
                      if (identity && wallet.provider === selected?.provider) goToDashboard();
                      else void connect(wallet);
                    }}
                    label={
                      identity && wallet.provider === selected?.provider
                        ? "Use this wallet"
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
