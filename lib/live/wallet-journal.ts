import {
  submitPrepared,
  validatePrepared,
  type Prepared,
  type WalletProvider,
} from "./wallet-transaction.ts";
export type Journal = {
  id: string;
  owner: string;
  nonce: string;
  action: string;
  deployment: string;
  hash: string;
  startedAt: number;
  state: "awaiting-wallet" | "submitted" | "unknown";
};
const key = (owner: string) => `freestock:wallet-recovery:4663:${owner.toLowerCase()}`;
export const JOURNAL_EVENT = "freestock:wallet-recovery";
export function readJournal(owner: string): Journal | null {
  const raw = window.localStorage.getItem(key(owner));
  if (!raw) return null;
  const value = JSON.parse(raw) as Journal;
  if (
    typeof value.id !== "string" ||
    !value.id ||
    value.owner.toLowerCase() !== owner.toLowerCase() ||
    !/^0x[\da-f]+$/i.test(value.nonce) ||
    (value.hash && !/^0x[\da-f]{64}$/i.test(value.hash))
  )
    throw Error("Wallet recovery data needs review before another transaction.");
  return value;
}
function locked<T>(owner: string, fn: () => T): Promise<T> {
  if (!navigator.locks)
    throw Error(
      "This browser cannot safely coordinate wallet requests across tabs. Open the site in an up-to-date wallet browser.",
    );
  return navigator.locks.request(key(owner), fn);
}
async function save(value: Journal, initial = false) {
  return locked(value.owner, () => {
    const current = readJournal(value.owner);
    if (initial ? !!current : current?.id !== value.id) return false;
    window.localStorage.setItem(key(value.owner), JSON.stringify(value));
    window.dispatchEvent(new Event(JOURNAL_EVENT));
    return true;
  });
}
export async function clearJournal(owner: string, requestId: string) {
  return locked(owner, () => {
    const current = readJournal(owner);
    if (!current || current.id !== requestId) return;
    window.localStorage.removeItem(key(owner));
    window.dispatchEvent(new Event(JOURNAL_EVENT));
  });
}
export async function submitJournaled(
  provider: WalletProvider,
  plan: Prepared,
  owner: string,
  account: string | null,
  isCurrent: () => boolean,
) {
  validatePrepared(plan, owner, account);
  if (readJournal(owner))
    throw Error("Resolve the previous wallet request before starting another.");
  const entry: Journal = {
    id: crypto.randomUUID(),
    owner,
    nonce: plan.transaction.nonce!,
    action: plan.action,
    deployment: plan.deployment ?? "",
    hash: "",
    startedAt: Date.now(),
    state: "awaiting-wallet",
  };
  // This device-only journal is recovery metadata; balances and confirmations always come from chain.
  if (!(await save(entry, true)))
    throw Error("Resolve the previous wallet request before starting another.");
  let walletRequested = false;
  try {
    const hash = await submitPrepared(provider, plan, owner, account, () => {
      if (!isCurrent())
        throw Error("Wallet selection changed before submission. Refresh the preview.");
      walletRequested = true;
    });
    // Persist even when the initiating component has unmounted or the wallet changed.
    await save({ ...entry, hash, state: "submitted" });
    return hash;
  } catch (e) {
    if (!walletRequested || (e as { code?: number }).code === 4001)
      await clearJournal(owner, entry.id);
    else await save({ ...entry, state: "unknown" });
    throw e;
  }
}
