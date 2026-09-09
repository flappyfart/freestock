export const HISTORY_UPDATED = "freestock:history-updated";
export async function historyRequest<T>(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/live/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw Error(
      data.error ??
        "Your history could not be saved. Retry syncing without repeating the wallet transaction.",
    );
  window.dispatchEvent(new Event(HISTORY_UPDATED));
  return data;
}
