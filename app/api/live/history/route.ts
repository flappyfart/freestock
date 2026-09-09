import { identity, json, sameOrigin } from "../../../../lib/http";
import { db } from "../../../../lib/earn-store";
import { rpc, pin, withRpcReads } from "../../../../lib/live/chain";
import { verifiedAccount } from "../../../../lib/live/pilot";
import { createHistoryStore } from "../../../../lib/live/history-store";
import { createHistoryReader } from "../../../../lib/live/history-reader";
import { historyAddress, historyHash } from "../../../../lib/live/history-model";
export async function GET(request: Request) {
  const user = await identity();
  if (!user) return json({ error: "Sign in to load saved positions." }, 401);
  try {
    const q = new URL(request.url).searchParams,
      wallet = historyAddress(q.get("owner")),
      store = createHistoryStore(db());
    if (!q.get("account")) return json({ accounts: await store.list(user, wallet) });
    const account = historyAddress(q.get("account")),
      offset = Number(q.get("offset") ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000)
      return json({ error: "Invalid history page." }, 400);
    return json(await store.page({ user, wallet, account }, offset));
  } catch {
    return json(
      { error: "Saved activity could not be loaded. Your wallet and position are unchanged." },
      503,
    );
  }
}
export async function POST(request: Request) {
  const user = await identity();
  if (!user) return json({ error: "Sign in to save position activity." }, 401);
  if (!sameOrigin(request)) return json({ error: "This request must come from Freestock." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "Use a JSON request." }, 415);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Request body required." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        return json({ error: "Request too large." }, 413);
      }
      chunks.push(r.value);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      bytes.set(c, at);
      at += c.length;
    }
    const body = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const wallet = historyAddress(body.owner),
      deployment = historyHash(body.deployment);
    const service = createHistoryReader(
      { rpc, pin, verify: verifiedAccount },
      createHistoryStore(db()),
    );
    return await withRpcReads(async () => {
      if (body.action === "remember")
        return json({ account: await service.register(user, wallet, deployment) });
      if (body.action === "sync") return json(await service.sync(user, wallet, deployment));
      if (body.action === "track")
        return json({
          record: await service.track(
            user,
            wallet,
            deployment,
            historyHash(body.hash),
            body.replaces ? historyHash(body.replaces) : undefined,
          ),
        });
      return json({ error: "Choose a supported history action." }, 400);
    });
  } catch (e) {
    return json(
      {
        error:
          e instanceof SyntaxError
            ? "Invalid JSON."
            : "Activity could not be verified or saved. Check the account and transaction references, then retry syncing. Do not repeat a wallet transaction to fix history.",
      },
      e instanceof SyntaxError ? 400 : 503,
    );
  }
}
