// Application access only; provider eligibility and wallet ownership are separate.
export function hasLiveWalletAccess(userId: string | null) {
  return typeof userId === "string" && userId.length > 0 && userId === userId.trim();
}

export async function liveSessionScope(userId: string | null): Promise<string | null> {
  if (!hasLiveWalletAccess(userId)) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`freestock-session-v1:${userId}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function requiresSessionReset(previous: string | null | undefined, next: string | null) {
  return previous !== undefined && previous !== next;
}
