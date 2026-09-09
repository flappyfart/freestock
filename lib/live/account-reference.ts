// A browser convenience only. Every reference must be verified against chain before use.
type ReferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const HASH = /^0x[0-9a-f]{64}$/i;
function referenceKey(owner: string) {
  if (!/^0x[0-9a-f]{40}$/i.test(owner)) throw Error("Invalid wallet address.");
  return `freestock:account-reference:4663:${owner.toLowerCase()}`;
}
export function readAccountReference(owner: string, storage?: ReferenceStorage) {
  try {
    const target = storage ?? window.localStorage;
    const deployment = target.getItem(referenceKey(owner));
    if (deployment && !HASH.test(deployment))
      return {
        deployment: null,
        warning:
          "The saved account reference is invalid. Restore it using the creation transaction.",
      };
    return { deployment, warning: null };
  } catch {
    return {
      deployment: null,
      warning:
        "This browser could not read the saved account reference. You can still restore it using the creation transaction.",
    };
  }
}
export function saveAccountReference(
  owner: string,
  deployment: string,
  storage?: ReferenceStorage,
) {
  try {
    if (!HASH.test(deployment)) throw Error("Invalid deployment reference.");
    (storage ?? window.localStorage).setItem(referenceKey(owner), deployment);
    return null;
  } catch {
    return "The account is verified, but this browser could not save its reference. Bookmark this page or keep the creation transaction for your next visit.";
  }
}
export function forgetAccountReference(
  owner: string,
  deployment: string,
  storage?: ReferenceStorage,
) {
  try {
    const target = storage ?? window.localStorage;
    const key = referenceKey(owner);
    if (target.getItem(key)?.toLowerCase() === deployment.toLowerCase()) target.removeItem(key);
  } catch {
    // Storage must never be required to verify an account or recover funds.
  }
}

export type AccountReferenceCandidate = {
  deployment: string;
  source: "journal" | "url" | "saved";
};
export function accountRestoreCandidate(
  journalDeployment: string | null | undefined,
  urlDeployment: string | null,
  savedDeployment: string | null,
): AccountReferenceCandidate | null {
  if (journalDeployment) return { deployment: journalDeployment, source: "journal" };
  if (urlDeployment) return { deployment: urlDeployment, source: "url" };
  return savedDeployment ? { deployment: savedDeployment, source: "saved" } : null;
}
export function rejectedUrlAccountFallback(
  owner: string,
  rejected: AccountReferenceCandidate,
  status: number | undefined,
  hasPendingRequest: boolean,
  storage?: ReferenceStorage,
): AccountReferenceCandidate | null {
  // Only a definitive rejection of an unscoped URL permits trying this wallet's own reference.
  if (status !== 422 || rejected.source !== "url" || hasPendingRequest) return null;
  const saved = readAccountReference(owner, storage).deployment;
  if (!saved || saved.toLowerCase() === rejected.deployment.toLowerCase()) return null;
  return { deployment: saved, source: "saved" };
}
