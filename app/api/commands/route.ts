import { execute } from "../../../lib/store";
import { identity, json, sameOrigin } from "../../../lib/http";
import { parseCommand, RuleError } from "../../../lib/engine";
export async function POST(request: Request) {
  const owner = await identity();
  if (!owner) return json({ error: "Sign in to save your preview." }, 401);
  if (!sameOrigin(request)) return json({ error: "This request must come from freestock." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "Use a JSON request." }, 415);
  const key = request.headers.get("idempotency-key");
  if (!key || !/^[a-zA-Z0-9_-]{16,80}$/.test(key))
    return json({ error: "A valid request ID is required." }, 400);
  try {
    // Stream limit avoids buffering arbitrary request bodies in a Worker isolate.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Request body required." }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return json({ error: "Request is too large." }, 413);
      }
      chunks.push(r.value);
    }
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      joined.set(c, offset);
      offset += c.length;
    }
    const command = parseCommand(JSON.parse(new TextDecoder().decode(joined)));
    return json(await execute(owner, key, command));
  } catch (error) {
    if (error instanceof RuleError) return json({ error: error.message }, 422);
    if (error instanceof SyntaxError) return json({ error: "Invalid JSON." }, 400);
    return json(
      { error: "This action could not be confirmed. Retry with the same request ID." },
      503,
    );
  }
}
