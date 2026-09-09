export type BrowserWalletProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (event: string, callback: (value: unknown) => void) => void;
  removeListener?: (event: string, callback: (value: unknown) => void) => void;
};
export type DiscoveredWallet = {
  info: { uuid: string; name: string; rdns: string };
  provider: BrowserWalletProvider;
};
export function mergeDiscoveredWallet(all: DiscoveredWallet[], wallet: DiscoveredWallet) {
  if (!wallet?.provider?.request || !wallet.info?.uuid) return all;
  const same = all.find(
    (item) => item.provider === wallet.provider || item.info.uuid === wallet.info.uuid,
  );
  if (!same) return [...all, wallet];
  if (same.info.rdns === "injected" && wallet.info.rdns !== "injected")
    return all.map((item) => (item === same ? wallet : item));
  return all;
}
export function parseWalletIdentity(accounts: unknown, chain: unknown) {
  if (
    !Array.isArray(accounts) ||
    typeof accounts[0] !== "string" ||
    !/^0x[0-9a-f]{40}$/i.test(accounts[0]) ||
    typeof chain !== "string" ||
    !/^0x[0-9a-f]+$/i.test(chain)
  )
    throw Error("The wallet did not return a usable account and network.");
  const network = Number(BigInt(chain));
  if (!Number.isSafeInteger(network)) throw Error("The wallet returned an invalid network.");
  return { owner: accounts[0], network };
}
export async function readWalletIdentity(provider: BrowserWalletProvider) {
  const accounts = await provider.request({ method: "eth_accounts" });
  const chain = await provider.request({ method: "eth_chainId" });
  return parseWalletIdentity(accounts, chain);
}
export function createWalletRequestGate() {
  let busy = false;
  return {
    isBusy: () => busy,
    async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
      if (busy) return undefined;
      busy = true;
      try {
        return await operation();
      } finally {
        busy = false;
      }
    },
  };
}
export function dashboardRecoveryPath(search: string, hash = "") {
  return `/dashboard${search.startsWith("?") ? search : search ? `?${search}` : ""}${hash.startsWith("#") ? hash : hash ? `#${hash}` : ""}`;
}
