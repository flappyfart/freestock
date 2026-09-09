import test from "node:test";
import assert from "node:assert/strict";
import { Interface } from "ethers";
import { accountPlan, PILOT_STOCKS } from "../lib/live/account-plan.ts";
import { allocateBasket } from "../lib/live/basket.ts";
import {
  validatePrepared,
  submitPrepared,
  type Prepared,
  type WalletProvider,
} from "../lib/live/wallet-transaction.ts";
import { readJournal, clearJournal, submitJournaled } from "../lib/live/wallet-journal.ts";
import { USDG, ERC20_ABI } from "../lib/live/config.ts";
import artifact from "../contracts/artifacts/FreestockYieldAccount.artifact.json" with { type: "json" };
const owner = "0x0000000000000000000000000000000000001234",
  account = "0x0000000000000000000000000000000000005678",
  hash = `0x${"a".repeat(64)}`;
function plan(): Prepared {
  return {
    ...accountPlan(owner),
    action: "deploy",
    account: null,
    assets: "0",
    summary: "Create",
    minimumOut: null,
    tokenOut: null,
    simulation: "passed",
    estimatedGasCostWei: "1",
    hasGasBalance: true,
    canSubmit: true,
    expiresAt: new Date(Date.now() + 45000).toISOString(),
    transaction: { ...accountPlan(owner).transaction, gas: "0x1e8480", nonce: "0x0" },
  };
}
const accountAbi = new Interface(artifact.abi),
  tokenAbi = new Interface(ERC20_ABI);
function provider(handler?: (method: string) => unknown): WalletProvider {
  return {
    async request({ method }) {
      if (handler) {
        const result = handler(method);
        if (result !== undefined) return result;
      }
      if (method === "eth_accounts") return [owner];
      if (method === "eth_chainId") return "0x1237";
      if (method === "eth_sendTransaction") return hash;
      throw Error("Unexpected request");
    },
  };
}
function storage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { locks: { request: async (_name: string, callback: () => unknown) => callback() } },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
      dispatchEvent: () => true,
    },
  });
}
void test("live baskets allocate each micro unit once and reject unsafe selections", () => {
  const allocations = PILOT_STOCKS.map((s) => ({ symbol: s.symbol, weightBps: 2000 }));
  const result = allocateBasket(allocations, 1_000_003n);
  assert.equal(
    result.reduce((s, x) => s + x.amount, 0n),
    1_000_003n,
  );
  assert.equal(result.at(-1)!.amount, 200_003n);
  for (const bad of [
    [],
    [{ symbol: "MSFT", weightBps: 10000 }],
    [
      { symbol: "NVDA", weightBps: 5000 },
      { symbol: "NVDA", weightBps: 5000 },
    ],
    [{ symbol: "NVDA", weightBps: 9999 }],
    [{ symbol: "NVDA", weightBps: 1.2 }],
  ])
    assert.throws(() => allocateBasket(bad, 10n));
  assert.throws(() => allocateBasket(allocations, 4n));
});
void test("wallet submission rejects altered account creation, chain, sender, value and gas", async () => {
  for (const mutate of [
    (p: Prepared) => (p.transaction.data += "00"),
    (p: Prepared) => (p.transaction.from = account),
    (p: Prepared) => (p.transaction.value = "0x1"),
    (p: Prepared) => (p.transaction.chainId = "0x1"),
    (p: Prepared) => (p.transaction.gas = "0xffffffffffff"),
    (p: Prepared) => delete p.transaction.nonce,
  ]) {
    const p = plan();
    mutate(p);
    assert.throws(() => validatePrepared(p, owner, null));
  }
  let sends = 0;
  await assert.rejects(
    submitPrepared(
      provider((m) => {
        if (m === "eth_accounts") return [account];
        if (m === "eth_sendTransaction") sends++;
      }),
      plan(),
      owner,
      null,
    ),
  );
  await assert.rejects(
    submitPrepared(
      provider((m) => {
        if (m === "eth_chainId") return "0x1";
        if (m === "eth_sendTransaction") sends++;
      }),
      plan(),
      owner,
      null,
    ),
  );
  assert.equal(sends, 0);
});
void test("approval is bound to the exact reviewed account and amount", () => {
  const p = plan();
  Object.assign(p, { action: "approve", account, assets: "10000000" });
  p.transaction.to = USDG;
  p.transaction.data = tokenAbi.encodeFunctionData("approve", [account, 10_000_000n]);
  validatePrepared(p, owner, account);
  p.transaction.data = tokenAbi.encodeFunctionData("approve", [owner, 10_000_000n]);
  assert.throws(() => validatePrepared(p, owner, account));
  p.transaction.data = tokenAbi.encodeFunctionData("approve", [account, (1n << 256n) - 1n]);
  assert.throws(() => validatePrepared(p, owner, account));
});
void test("basket signing verifies every stock, spend amount, minimum and deadline", () => {
  const p = plan();
  const deadline = Math.floor(Date.now() / 1000) + 100;
  Object.assign(p, {
    action: "harvest",
    account,
    assets: "50000",
    purchases: PILOT_STOCKS.map((s) => ({
      symbol: s.symbol,
      tokenOut: s.address,
      amountIn: "10000",
      amountOut: "11",
      minimumOut: "10",
      fee: 500,
      weightBps: 2000,
    })),
  });
  p.transaction.to = account;
  p.transaction.data = accountAbi.encodeFunctionData("harvest", [
    PILOT_STOCKS.map((s) => s.address),
    [500, 500, 500, 500, 500],
    [10000, 10000, 10000, 10000, 10000],
    [10, 10, 10, 10, 10],
    0,
    deadline,
  ]);
  validatePrepared(p, owner, account);
  p.purchases![0].fee = 3000;
  assert.throws(() => validatePrepared(p, owner, account));
  p.purchases![0].fee = 500;
  p.purchases![0].amountOut = "100";
  assert.throws(() => validatePrepared(p, owner, account));
  p.purchases![0].amountOut = "11";
  p.purchases![0].minimumOut = "0";
  assert.throws(() => validatePrepared(p, owner, account));
  p.purchases![0].minimumOut = "10";
  p.purchases![0].amountIn = "20000";
  assert.throws(() => validatePrepared(p, owner, account));
  p.purchases![0].amountIn = "10000";
  p.purchases![0].symbol = "MSFT";
  assert.throws(() => validatePrepared(p, owner, account));
});
void test("expired or cancelled pre-send context never opens a financial wallet request", async () => {
  let sends = 0;
  const p = plan();
  const wallet = provider((m) => {
    if (m === "eth_accounts") p.expiresAt = new Date(0).toISOString();
    if (m === "eth_sendTransaction") sends++;
  });
  await assert.rejects(submitPrepared(wallet, p, owner, null));
  await assert.rejects(
    submitPrepared(
      provider((m) => {
        if (m === "eth_sendTransaction") sends++;
      }),
      plan(),
      owner,
      null,
      () => {
        throw Error("Selection changed");
      },
    ),
  );
  assert.equal(sends, 0);
});
void test("a late wallet response is retained after the initiating view disappears", async () => {
  storage();
  let current = true;
  let release: ((v: string) => void) | undefined;
  const waiting = submitJournaled(
    provider((m) =>
      m === "eth_sendTransaction"
        ? new Promise<string>((resolve) => {
            release = resolve;
          })
        : undefined,
    ),
    plan(),
    owner,
    null,
    () => current,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(readJournal(owner)?.state, "awaiting-wallet");
  current = false;
  release!(hash);
  assert.equal(await waiting, hash);
  assert.equal(readJournal(owner)?.hash, hash);
  assert.equal(readJournal(owner)?.state, "submitted");
  await clearJournal(owner, `0x${"b".repeat(64)}`);
  assert.ok(readJournal(owner));
  await clearJournal(owner, readJournal(owner)!.id);
  assert.equal(readJournal(owner), null);
});
void test("ambiguous post-send errors prevent retries; explicit rejection releases the journal", async () => {
  storage();
  let sends = 0;
  const unknown = provider((m) => {
    if (m === "eth_sendTransaction") {
      sends++;
      throw Error("Transport interrupted");
    }
  });
  await assert.rejects(submitJournaled(unknown, plan(), owner, null, () => true));
  assert.equal(readJournal(owner)?.state, "unknown");
  await assert.rejects(submitJournaled(unknown, plan(), owner, null, () => true));
  assert.equal(sends, 1);
  storage();
  await assert.rejects(
    submitJournaled(
      provider((m) => {
        if (m === "eth_sendTransaction") throw Object.assign(Error("Rejected"), { code: 4001 });
      }),
      plan(),
      owner,
      null,
      () => true,
    ),
  );
  assert.equal(readJournal(owner), null);
});

void test("reconciled requests cannot overwrite or clear a successor after a late wallet result", async () => {
  storage();
  let releaseA: ((hash: string) => void) | undefined,
    releaseB: ((hash: string) => void) | undefined;
  const first = submitJournaled(
    provider((m) =>
      m === "eth_sendTransaction"
        ? new Promise<string>((r) => {
            releaseA = r;
          })
        : undefined,
    ),
    plan(),
    owner,
    null,
    () => true,
  );
  await new Promise((r) => setTimeout(r, 0));
  const oldId = readJournal(owner)!.id;
  await clearJournal(owner, oldId);
  const next = plan();
  next.transaction.nonce = "0x1";
  const second = submitJournaled(
    provider((m) =>
      m === "eth_sendTransaction"
        ? new Promise<string>((r) => {
            releaseB = r;
          })
        : undefined,
    ),
    next,
    owner,
    null,
    () => true,
  );
  await new Promise((r) => setTimeout(r, 0));
  const newId = readJournal(owner)!.id;
  assert.notEqual(oldId, newId);
  releaseA!(hash);
  await first;
  assert.equal(readJournal(owner)!.id, newId);
  assert.equal(readJournal(owner)!.hash, "");
  await clearJournal(owner, oldId);
  assert.equal(readJournal(owner)!.id, newId);
  const newHash = `0x${"b".repeat(64)}`;
  releaseB!(newHash);
  await second;
  assert.equal(readJournal(owner)!.hash, newHash);
});
