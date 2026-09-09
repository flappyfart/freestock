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
  await Promise.resolve();
  assert.equal(calls, 1);
  resolve(ok("first"));
  await a;
  const c = reader(endpoint, "eth_call", [{ from: "ownerA", data: "0x01" }, "latest"]);
  await Promise.resolve();
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

async function settle() {
  // Drain promise continuations without real waiting or network requests.
  for (let i = 0; i < 30; i++) await Promise.resolve();
}
function controlled() {
  let time = 0;
  const requests: { url: string; at: number; resolve: (r: Response) => void }[] = [];
  const sleepers: { due: number; resolve: () => void }[] = [];
  const reader = createRpcReader({
    now: () => time,
    random: () => 0,
    sleep: (ms) => new Promise<void>((resolve) => sleepers.push({ due: time + ms, resolve })),
    fetcher: ((url) => new Promise<Response>((resolve) => {
      requests.push({ url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url, at: time, resolve });
    })) as typeof fetch,
  });
  const advance = async (ms: number) => {
    time += ms;
    for (let i = sleepers.length - 1; i >= 0; i--) {
      if (sleepers[i].due <= time) sleepers.splice(i, 1)[0].resolve();
    }
    await settle();
  };
  return { reader, requests, advance };
}
void test("twelve distinct reads never exceed three active requests and all complete", async () => {
  const f = controlled();
  const work = Array.from({ length: 12 }, (_, i) => f.reader(endpoint, "eth_getBalance", [i, "latest"]));
  await settle();
  assert.equal(f.requests.length, 3);
  for (let i = 0; i < 12; i++) {
    assert.equal(f.requests.length, Math.min(12, i + 3));
    f.requests[i].resolve(ok(i));
    await settle();
  }
  assert.deepEqual(await Promise.all(work), Array.from({ length: 12 }, (_, i) => i));
});
void test("429 cooldown blocks queued first attempts and concurrent retries until Retry-After", async () => {
  const f = controlled();
  const work = Array.from({ length: 4 }, (_, i) => f.reader(endpoint, "eth_getBalance", [i, "latest"]));
  await settle();
  f.requests[0].resolve(new Response(null, { status: 429, headers: { "retry-after": "1" } }));
  f.requests[1].resolve(ok("b"));
  f.requests[2].resolve(ok("c"));
  await settle();
  assert.equal(f.requests.length, 3);
  await f.advance(999);
  assert.equal(f.requests.length, 3);
  await f.advance(1);
  assert.equal(f.requests.length, 5);
  assert.ok(f.requests.slice(3).every((r) => r.at >= 1000));
  f.requests[3].resolve(ok("fresh"));
  f.requests[4].resolve(ok("fresh"));
  assert.deepEqual(await Promise.all(work), ["fresh", "b", "c", "fresh"]);
});
void test("persistent 429 rejects the whole twelve-read fanout after the first three responses", async () => {
  const f = controlled();
  const work = Promise.allSettled(Array.from({ length: 12 }, (_, i) =>
    f.reader(endpoint, "eth_getBalance", [i, "latest"])));
  await settle();
  for (const request of f.requests) request.resolve(new Response(null, { status: 429 }));
  await settle();
  await f.advance(2000);
  const results = await work;
  assert.equal(f.requests.length, 3);
  assert.ok(results.every((r) => r.status === "rejected" && r.reason instanceof RpcReadError && r.reason.upstreamStatus === 429));
});
void test("shared 429 retry budget remains exhausted even after an unrelated read succeeds", async () => {
  const f = fake([
    new Response(null, { status: 429 }), ok("first"),
    new Response(null, { status: 429 }), ok("second"),
    new Response(null, { status: 429 }),
  ]);
  assert.equal(await f.reader(endpoint, "eth_getBalance", [1]), "first");
  assert.equal(await f.reader(endpoint, "eth_getBalance", [2]), "second");
  await assert.rejects(f.reader(endpoint, "eth_getBalance", [3]), (e: unknown) => e instanceof RpcReadError && e.upstreamStatus === 429);
  await assert.rejects(f.reader(endpoint, "eth_getBalance", [4]), (e: unknown) => e instanceof RpcReadError && e.upstreamStatus === 429);
  assert.equal(f.calls(), 5);
});
void test("long cooldown stops later reads to that endpoint but not another endpoint or request scope", async () => {
  const f = fake([new Response(null, { status: 429, headers: { "retry-after": "30" } }), ok("other")]);
  await assert.rejects(f.reader(endpoint, "eth_chainId", []), RpcReadError);
  await assert.rejects(f.reader(endpoint, "eth_getCode", ["owner", "latest"]), RpcReadError);
  assert.equal(f.calls(), 1);
  assert.equal(await f.reader("https://other.example/rpc", "eth_chainId", []), "other");
  const next = fake([ok("new inbound request")]);
  assert.equal(await next.reader(endpoint, "eth_chainId", []), "new inbound request");
});
void test("time spent queued counts toward the ten-second read budget", async () => {
  const f = controlled();
  const work = Promise.allSettled(Array.from({ length: 4 }, (_, i) =>
    f.reader(endpoint, "eth_getBalance", [i, "latest"])));
  await settle();
  await f.advance(10000);
  for (const request of f.requests) request.resolve(ok());
  const results = await work;
  assert.equal(f.requests.length, 3);
  assert.equal(results[3].status, "rejected");
});
