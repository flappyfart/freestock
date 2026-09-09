import test from "node:test";
import assert from "node:assert/strict";
import { createRpcReader, RpcReadError, type RpcDiagnostic } from "../lib/live/rpc-reader.ts";
const endpoint = "https://public.example/rpc";
const ok = (result: unknown = "0x1237") => Response.json({ jsonrpc: "2.0", id: 1, result });
function fake(sequence: (Response | Error)[]) {
  let count = 0,
    time = 0;
  const delays: number[] = [],
    events: RpcDiagnostic[] = [],
    bodies: unknown[] = [];
  const reader = createRpcReader({
    fetcher: (async (_url, init) => {
      assert.equal(typeof init?.body, "string");
      assert.equal(init?.redirect, "manual");
      bodies.push(JSON.parse(init!.body as string));
      const item = sequence[count++];
      if (item instanceof Error) throw item;
      return item;
    }) as typeof fetch,
    now: () => time,
    sleep: async (ms) => {
      delays.push(ms);
      time += ms;
    },
    random: () => 0,
    report: (event) => events.push(event),
  });
  return { reader, delays, events, bodies, calls: () => count };
}
void test("429 honors short Retry-After then returns a fresh read", async () => {
  const f = fake([
    new Response("rate limited", { status: 429, headers: { "retry-after": "1" } }),
    ok(),
  ]);
  assert.equal(await f.reader(endpoint, "eth_chainId", []), "0x1237");
  assert.equal(f.calls(), 2);
  assert.deepEqual(f.delays, [1000]);
  assert.equal(f.events[0].upstreamStatus, 429);
});
void test("long Retry-After fails without ignoring the provider cooldown", async () => {
  const f = fake([new Response("busy", { status: 429, headers: { "retry-after": "30" } })]);
  await assert.rejects(
    f.reader(endpoint, "eth_chainId", []),
    (e: unknown) => e instanceof RpcReadError && e.upstreamStatus === 429,
  );
  assert.equal(f.calls(), 1);
  assert.deepEqual(f.delays, []);
});
void test("HTTP403 is distinguished and never retried; diagnostics exclude secrets", async () => {
  const f = fake([
    new Response("private gateway body", { status: 403, headers: { "cf-ray": "abc123-DEN" } }),
  ]);
  await assert.rejects(
    f.reader("https://provider.example/secret-key", "eth_call", [
      { from: "private-wallet", data: "private-data" },
      "latest",
    ]),
    /refused/,
  );
  assert.equal(f.calls(), 1);
  const diagnostic = JSON.stringify(f.events);
  assert.equal(f.events[0].upstreamStatus, 403);
  assert.equal(f.events[0].ray, "abc123-DEN");
  for (const secret of ["private", "secret-key", "provider.example"])
    assert.ok(!diagnostic.includes(secret));
});
void test("transient failures have a hard three-attempt bound", async () => {
  const f = fake([
    new Response(null, { status: 503 }),
    new Response(null, { status: 502 }),
    new Response(null, { status: 504 }),
  ]);
  await assert.rejects(f.reader(endpoint, "eth_blockNumber", []), RpcReadError);
  assert.equal(f.calls(), 3);
  assert.deepEqual(f.delays, [300, 600]);
});
void test("HTTP500 retries are bounded reads", async () => {
  const f = fake([new Response(null, { status: 500 }), ok("0x8")]);
  assert.equal(await f.reader(endpoint, "eth_blockNumber", []), "0x8");
  assert.equal(f.calls(), 2);
  assert.deepEqual(f.delays, [300]);
});
void test("a connection failure may retry a read", async () => {
  const f = fake([new TypeError("network unavailable"), ok("0x7")]);
  assert.equal(await f.reader(endpoint, "eth_blockNumber", []), "0x7");
  assert.equal(f.calls(), 2);
});
void test("JSON-RPC simulation reverts are not retried", async () => {
  const f = fake([Response.json({ id: 1, error: { code: 3, message: "execution reverted" } })]);
  await assert.rejects(
    f.reader(endpoint, "eth_call", [{ to: "0x1234" }, "latest"]),
    (e: unknown) => e instanceof RpcReadError && e.code === "simulation",
  );
  assert.equal(f.calls(), 1);
});
void test("only identical in-flight calls coalesce; completed responses are never cached", async () => {
  let calls = 0;
  let resolve!: (r: Response) => void;
  const reader = createRpcReader({
    fetcher: (async () => {
      calls++;
      return new Promise<Response>((r) => {
        resolve = r;
      });
    }) as typeof fetch,
  });
  const a = reader(endpoint, "eth_call", [{ from: "ownerA", data: "0x01" }, "latest"]);
  const b = reader(endpoint, "eth_call", [{ from: "ownerA", data: "0x01" }, "latest"]);
  assert.equal(a, b);
  assert.equal(calls, 1);
  resolve(ok("first"));
  await a;
  const c = reader(endpoint, "eth_call", [{ from: "ownerA", data: "0x01" }, "latest"]);
  assert.equal(calls, 2);
  resolve(ok("fresh"));
  assert.equal(await c, "fresh");
});
void test("different caller, params, endpoint and request scope never coalesce", async () => {
  const f = fake([ok(), ok(), ok(), ok()]);
  await Promise.all([
    f.reader(endpoint, "eth_call", [{ from: "ownerA" }, "latest"]),
    f.reader(endpoint, "eth_call", [{ from: "ownerB" }, "latest"]),
    f.reader(endpoint, "eth_call", [{ from: "ownerA" }, "0x1"]),
    f.reader("https://other.example/rpc", "eth_call", [{ from: "ownerA" }, "latest"]),
  ]);
  assert.equal(f.calls(), 4);
  const other = fake([ok()]);
  await other.reader(endpoint, "eth_call", [{ from: "ownerA" }, "latest"]);
  assert.equal(other.calls(), 1);
});
void test("send and signing methods cannot reach fetch", async () => {
  const f = fake([]);
  for (const method of [
    "eth_sendTransaction",
    "eth_sendRawTransaction",
    "eth_sign",
    "personal_sign",
    "anvil_setBalance",
  ])
    await assert.rejects(
      f.reader(endpoint, method, []),
      (e: unknown) => e instanceof RpcReadError && e.code === "unsupported",
    );
  assert.equal(f.calls(), 0);
});
void test("pending receipt null is valid, malformed response is not retried", async () => {
  const f = fake([ok(null), Response.json({ id: 99, result: "0x1237" })]);
  assert.equal(await f.reader(endpoint, "eth_getTransactionReceipt", ["0xhash"]), null);
  await assert.rejects(f.reader(endpoint, "eth_chainId", []), /Invalid response/);
  assert.equal(f.calls(), 2);
});
