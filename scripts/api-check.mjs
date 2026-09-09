import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// This intentionally impersonates dispatch headers only against an isolated local
// Worker test server. The hostname guard and redirect refusal must remain intact.
const configuredOrigin = process.env.TEST_ORIGIN || "http://localhost:3011";
let target;
try {
  target = new URL(configuredOrigin);
} catch {
  throw new Error("TEST_ORIGIN must be a local HTTP origin.");
}
if (
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  !["http:", "https:"].includes(target.protocol) ||
  target.username ||
  target.password ||
  target.pathname !== "/" ||
  target.search ||
  target.hash
) {
  throw new Error(
    "Refusing to mutate a hosted site: TEST_ORIGIN must be localhost or 127.0.0.1 with no path, credentials, query, or fragment.",
  );
}
const ORIGIN = target.origin;

const runId = `api-${Date.now()}-${randomUUID().slice(0, 8)}`;
const user = (suffix) => ({ id: `${runId}-${suffix}`, email: `${runId}-${suffix}@example.test` });
const alice = user("alice");
const bob = user("bob");

const key = (label) => `${runId}-${label}-${randomUUID().slice(0, 8)}`;
const report = [];
let requests = 0;
let transportRetries = 0;
let serviceRetries = 0;

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const identity = options.user === undefined ? alice : options.user;
  if (identity) {
    headers.set("oai-authenticated-user-id", identity.id);
    headers.set("oai-authenticated-user-email", identity.email);
  }
  if (options.origin !== null) headers.set("origin", options.origin ?? ORIGIN);
  if (!headers.has("sec-fetch-site")) headers.set("sec-fetch-site", "same-origin");
  let body;
  if (Object.hasOwn(options, "raw")) body = options.raw;
  else if (Object.hasOwn(options, "body")) body = JSON.stringify(options.body);
  if (body !== undefined && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  if (options.key) headers.set("idempotency-key", options.key);
  requests++;
  const response = await fetch(new URL(path, ORIGIN), {
    method: options.method || (body === undefined ? "GET" : "POST"),
    headers,
    body,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `${options.method || "request"} ${path} returned non-JSON HTTP ${response.status}: ${text.slice(0, 200)}`,
    );
  }
  return { status: response.status, data, headers: response.headers };
}

function expectStatus(result, status) {
  assert.equal(
    result.status,
    status,
    `Expected HTTP ${status}; got ${result.status}: ${JSON.stringify(result.data)}`,
  );
  assert.match(
    result.headers.get("cache-control") || "",
    /no-store/,
    "Private API response must not be cached",
  );
  assert.equal(result.headers.get("x-content-type-options"), "nosniff");
  return result.data;
}

async function readAccount(identity = alice) {
  const data = expectStatus(await request("/api/earn/account", { user: identity }), 200);
  assert.equal(data.mode, "simulation");
  assert.equal(data.realDepositsEnabled, false);
  assert.ok(Number.isSafeInteger(data.version) && data.version >= 0);
  const s = data.state;
  assert.equal(
    s.wallet +
      s.positions.reduce((n, p) => n + p.capital + p.pending, 0) +
      Object.values(s.holdings).reduce((n, h) => n + h.cost, 0),
    10000e6 + s.positions.reduce((n, p) => n + p.earned, 0),
  );
  return data;
}

async function command(identity, body, commandKey = key(body.type)) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let result;
    try {
      result = await request("/api/earn/commands", { user: identity, body, key: commandKey });
    } catch (error) {
      if (attempt === 4) throw error;
      transportRetries++;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
      continue;
    }
    if (result.status === 503 && attempt < 4) {
      serviceRetries++;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
      continue;
    }
    const data = expectStatus(result, 200);
    assert.equal(data.receipt.key, commandKey);
    assert.ok(Number.isSafeInteger(data.receipt.version) && data.receipt.version > 0);
    assert.ok(data.version >= data.receipt.version);
    assert.equal(typeof data.replayed, "boolean");
    return data;
  }
  throw new Error(`Could not confirm command ${commandKey}; retry this same key.`);
}

async function rejected(body, status, options = {}) {
  return expectStatus(
    await request("/api/earn/commands", { body, key: key("rejected"), ...options }),
    status,
  );
}

async function check(name, fn) {
  await fn();
  report.push(name);
  console.log(`PASS ${name}`);
}

const open = {
  type: "open",
  kind: "lend",
  amount: 1000e6,
  allocation: [
    { symbol: "NVDA", bps: 6000 },
    { symbol: "AAPL", bps: 4000 },
  ],
  auto: true,
  threshold: 1e6,
  compoundBps: 5000,
  leverage: 1,
  feeApr: 0,
  borrowApr: 0,
  costApr: 0,
};
async function main() {
  console.log(`Local DeFi API checks: ${ORIGIN}; isolated identities ${runId}`);
  await check(
    "health separates live sign-in requirements from simulation",
    async () => {
      const v = expectStatus(await request("/api/health", { user: null }), 200);
      assert.equal(v.mode, "live-wallet-with-simulation");
      assert.equal(v.liveStatusEndpoint, "/api/live/status");
      assert.equal(v.earnings.simulation, "explicit-time-simulation");
      assert.equal(v.earnings.live, "wallet-approved-transactions");
      assert.equal(v.realDepositsEnabled, false);
      assert.equal(v.realTradingEnabled, false);
      assert.equal(v.automation, "recommendations-with-manual-approval");
    },
  );
  await check("anonymous and incomplete identities cannot access accounts or mutate", async () => {
    expectStatus(await request("/api/earn/account", { user: null }), 401);
    await rejected(open, 401, { user: null });
    expectStatus(
      await request("/api/earn/account", {
        user: null,
        headers: { "oai-authenticated-user-id": alice.id },
      }),
      401,
    );
  });
  await check("cross-origin and malformed requests reject without saving", async () => {
    await rejected(open, 403, { origin: "https://foreign.example" });
    await rejected(open, 403, { origin: null });
    await rejected(open, 403, { headers: { "sec-fetch-site": "cross-site" } });
    await rejected(open, 415, { headers: { "content-type": "text/plain" } });
    await rejected(open, 400, { key: "short" });
    expectStatus(await request("/api/earn/commands", { raw: "{", key: key("json") }), 400);
    expectStatus(
      await request("/api/earn/commands", {
        raw: JSON.stringify({ ...open, padding: "x".repeat(5000) }),
        key: key("size"),
      }),
      413,
    );
    await rejected({ ...open, amount: -1 }, 422);
    await rejected({ ...open, allocation: [{ symbol: "NVDA", bps: 100 }] }, 422);
    assert.equal((await readAccount()).version, 0);
  });
  await check("duplicate deposit applies once and key mismatch rejects", async () => {
    const k = key("same");
    const first = await command(alice, open, k);
    const replay = await command(alice, open, k);
    assert.deepEqual(replay.receipt, first.receipt);
    assert.equal(replay.replayed, true);
    assert.equal((await readAccount()).state.wallet, 9000e6);
    await rejected({ ...open, amount: 1001e6 }, 422, { key: k });
  });
  await check("owner separation and query spoofing preserve separate accounts", async () => {
    const b = await readAccount(bob);
    assert.equal(b.state.wallet, 10000e6);
    const selected = expectStatus(
      await request(`/api/earn/account?owner=${alice.id}`, { user: bob }),
      200,
    );
    assert.equal(selected.state.wallet, b.state.wallet);
    await rejected({ type: "close", positionId: "p1" }, 422, { user: bob });
  });
  await check("concurrent same-key requests apply exactly once", async () => {
    const before = await readAccount();
    const k = key("concurrent");
    const results = await Promise.all(
      Array.from({ length: 5 }, () => command(alice, { ...open, amount: 100e6 }, k)),
    );
    for (const r of results) assert.deepEqual(r.receipt, results[0].receipt);
    const after = await readAccount();
    assert.equal(after.version, before.version + 1);
    assert.equal(after.state.wallet, before.state.wallet - 100e6);
  });
  await check("concurrent distinct requests preserve every deposit", async () => {
    const before = await readAccount();
    await Promise.all([10, 20, 30, 40].map((n) => command(alice, { ...open, amount: n * 1e6 })));
    const after = await readAccount();
    assert.equal(after.version, before.version + 4);
    assert.equal(after.state.wallet, before.state.wallet - 100e6);
  });
  await check("auto-conversion and compounding save together and reflect in reads", async () => {
    const advanced = await command(alice, {
      type: "advance",
      positionId: "p1",
      days: 30,
      shockPct: 0,
    });
    const p = advanced.state.positions[0];
    assert.ok(p.compounded > 0);
    assert.ok(p.converted > 0);
    assert.equal(p.pending, 0);
    assert.ok(advanced.state.holdings.NVDA);
    assert.ok(advanced.state.holdings.AAPL);
    assert.deepEqual((await readAccount()).state, advanced.state);
  });
  await check(
    "new allocation rules preserve old holdings and change future purchases",
    async () => {
      const before = (await readAccount()).state.holdings.NVDA;
      await command(alice, {
        type: "configure",
        positionId: "p1",
        allocation: [{ symbol: "MSFT", bps: 10000 }],
        auto: true,
        threshold: 1e6,
        compoundBps: 0,
      });
      const after = await command(alice, {
        type: "advance",
        positionId: "p1",
        days: 30,
        shockPct: 0,
      });
      assert.deepEqual(after.state.holdings.NVDA, before);
      assert.ok(after.state.holdings.MSFT);
    },
  );
  await check("closing remains idempotent and does not erase holdings", async () => {
    const k = key("close");
    const first = await command(alice, { type: "close", positionId: "p1" }, k);
    const repeat = await command(alice, { type: "close", positionId: "p1" }, k);
    assert.equal(repeat.version, first.version);
    assert.ok(repeat.state.holdings.MSFT);
    await rejected({ type: "advance", positionId: "p1", days: 1, shockPct: 0 }, 422);
  });
  await check("LP loss scenario defers both compounding and conversion", async () => {
    const s = await command(bob, {
      ...open,
      kind: "lp",
      leverage: 2,
      feeApr: 0,
      borrowApr: 0,
      costApr: 0,
    });
    assert.equal(s.state.positions[0].name, "Leveraged LP model");
    const loss = await command(bob, { type: "advance", positionId: "p1", days: 30, shockPct: -10 });
    assert.equal(loss.state.positions[0].capital, 800e6);
    assert.equal(loss.state.positions[0].lossCarry, 200e6);
    assert.deepEqual(loss.state.holdings, {});
  });
  await check(
    "market data is explicitly sourced and retired prize writes are disabled",
    async () => {
      const m = expectStatus(await request("/api/markets", { user: null }), 200);
      assert.ok(["live", "snapshot"].includes(m.status));
      assert.equal(m.markets.length, 5);
      assert.equal(m.vault.name, "Steakhouse USDG");
      assert.ok(m.vault.apy < 1);
      assert.ok(m.asOf);
      expectStatus(
        await request("/api/commands", {
          body: { type: "deposit", amount: "1" },
          key: key("retired"),
        }),
        410,
      );
    },
  );
  console.log(
    `PASS ${report.length} integration groups; ${requests} HTTP requests; ${serviceRetries} service retries; ${transportRetries} transport retries. No hosted accounts were changed.`,
  );
}
main().catch((error) => {
  console.error(`FAIL after ${report.length} groups: ${error.stack || error}`);
  process.exitCode = 1;
});
