import test from "node:test";
import assert from "node:assert/strict";
import {
  initialEarnState,
  applyEarnCommand,
  parseEarnCommand,
  type EarnState,
  type EarnCommand,
  type Context,
} from "../lib/earn-engine.ts";
const context: Context = {
  at: "2026-09-08T23:00:00Z",
  vault: {
    id: "vault4663",
    name: "Steakhouse USDG",
    apy: 0.0376737758134109,
    asOf: "2026-09-08T22:04:00Z",
    source: "Test snapshot",
  },
};
const open: EarnCommand = {
  type: "open",
  kind: "lend",
  amount: 1000e6,
  allocation: [
    { symbol: "NVDA", bps: 6000 },
    { symbol: "AAPL", bps: 4000 },
  ],
  auto: false,
  threshold: 5e6,
  compoundBps: 0,
  leverage: 1,
  feeApr: 0,
  borrowApr: 0,
  costApr: 0,
};
const step: EarnCommand = { type: "advance", positionId: "p1", days: 30, shockPct: 0 };
function apply(s: EarnState, c: EarnCommand) {
  const result = applyEarnCommand(s, c, context);
  invariant(result);
  return result;
}
function invariant(s: EarnState) {
  const accounted =
    s.wallet +
    s.positions.reduce((n, p) => n + p.capital + p.pending, 0) +
    Object.values(s.holdings).reduce((n, h) => n + h!.cost, 0);
  assert.equal(accounted, 10_000e6 + s.positions.reduce((n, p) => n + p.earned, 0));
  for (const p of s.positions) {
    for (const value of [p.capital, p.pending, p.lossCarry, p.converted, p.compounded])
      assert.ok(Number.isSafeInteger(value) && value >= 0);
    assert.ok(!p.lossCarry || p.pending === 0);
  }
}
void test("opening moves capital, uses server rate, preserves caller state", () => {
  const source = initialEarnState();
  const s = apply(source, open);
  assert.equal(source.positions.length, 0);
  assert.equal(s.wallet, 9000e6);
  assert.equal(s.positions[0].apy, context.vault.apy);
});
void test("lending step does not secretly compound pending earnings", () => {
  const s = apply(initialEarnState(), open);
  const monthly = apply(s, step);
  let daily = s;
  for (let i = 0; i < 30; i++) daily = apply(daily, { ...step, days: 1 });
  assert.ok(Math.abs(daily.positions[0].pending - monthly.positions[0].pending) <= 1);
  assert.equal(monthly.positions[0].capital, 1000e6);
});
void test("conversion conserves exact budget, records basket quantities and cannot spend twice", () => {
  let s = apply(apply(initialEarnState(), open), step);
  const budget = s.positions[0].pending;
  s = apply(s, { type: "convert", positionId: "p1" });
  assert.equal(s.positions[0].pending, 0);
  assert.equal(s.holdings.NVDA!.cost + s.holdings.AAPL!.cost, budget);
  assert.equal(s.holdings.NVDA!.quantity, s.holdings.NVDA!.cost / 1e6 / 180);
  assert.throws(() => apply(s, { type: "convert", positionId: "p1" }));
});
void test("auto conversion waits for the threshold and runs atomically with the advance", () => {
  let s = apply(initialEarnState(), { ...open, auto: true });
  s = apply(s, step);
  assert.deepEqual(s.holdings, {});
  s = apply(s, step);
  assert.ok(s.holdings.NVDA);
  assert.equal(s.positions[0].pending, 0);
  assert.equal(s.entries.at(-1)!.action, "Stock conversion");
});
void test("full compounding grows DeFi capital without inventing stock income", () => {
  let s = apply(initialEarnState(), { ...open, auto: true, compoundBps: 10000 });
  s = apply(s, step);
  assert.equal(s.positions[0].pending, 0);
  assert.equal(s.positions[0].capital, 1000e6 + s.positions[0].earned);
  assert.deepEqual(s.holdings, {});
  const prior = s.positions[0].earned;
  s = apply(s, step);
  assert.ok(s.positions[0].earned - prior > prior);
});
void test("split allocates each micro unit once across compounding and stocks", () => {
  let s = apply(initialEarnState(), {
    ...open,
    amount: 5000e6,
    compoundBps: 4000,
    auto: true,
    threshold: 1e6,
  });
  s = apply(s, step);
  assert.ok(s.positions[0].compounded > 0);
  assert.equal(s.positions[0].pending, 0);
  assert.equal(s.positions[0].earned, s.positions[0].compounded + s.positions[0].converted);
});
void test("manual compounding transfers pending earnings without new income", () => {
  let s = apply(apply(initialEarnState(), open), step);
  const earned = s.positions[0].earned;
  s = apply(s, { type: "compound", positionId: "p1" });
  assert.equal(s.positions[0].earned, earned);
  assert.equal(s.positions[0].capital, 1000e6 + earned);
  assert.equal(s.positions[0].pending, 0);
});
void test("new basket rules affect future conversions only", () => {
  let s = apply(apply(initialEarnState(), open), step);
  s = apply(s, { type: "convert", positionId: "p1" });
  const before = structuredClone(s.holdings);
  s = apply(s, {
    type: "configure",
    positionId: "p1",
    allocation: [{ symbol: "MSFT", bps: 10000 }],
    auto: true,
    threshold: 1e6,
    compoundBps: 0,
  });
  s = apply(s, step);
  assert.deepEqual(s.holdings.NVDA, before.NVDA);
  assert.ok(s.holdings.MSFT);
});
void test("LP costs can erase earnings and capital; gains restore losses before payouts", () => {
  let s = apply(initialEarnState(), {
    ...open,
    kind: "lp",
    leverage: 2,
    feeApr: 0,
    borrowApr: 0,
    costApr: 0,
    auto: true,
    threshold: 1e6,
    compoundBps: 5000,
  });
  s = apply(s, { ...step, shockPct: -10 });
  assert.equal(s.positions[0].capital, 800e6);
  assert.equal(s.positions[0].lossCarry, 200e6);
  s = apply(s, { ...step, shockPct: 10 });
  assert.equal(s.positions[0].capital, 960e6);
  assert.equal(s.positions[0].lossCarry, 40e6);
  assert.deepEqual(s.holdings, {});
  assert.equal(s.positions[0].compounded, 0);
  s = apply(s, { ...step, shockPct: 10 });
  assert.equal(s.positions[0].lossCarry, 0);
  assert.ok(s.positions[0].compounded > 0);
  assert.ok(s.positions[0].converted > 0);
});
void test("negative LP fee net return consumes pending before capital", () => {
  let s = apply(initialEarnState(), {
    ...open,
    kind: "lp",
    leverage: 2,
    feeApr: 0,
    borrowApr: 20,
    costApr: 1,
  });
  s = apply(s, step);
  assert.ok(s.positions[0].earned < 0);
  assert.ok(s.positions[0].lossCarry > 0);
  assert.deepEqual(s.holdings, {});
});
void test("extreme modeled losses floor equity and permit exit", () => {
  let s = apply(initialEarnState(), { ...open, kind: "lp", leverage: 3 });
  s = apply(s, { ...step, shockPct: -50 });
  assert.equal(s.positions[0].capital, 0);
  assert.equal(s.positions[0].earned, -1000e6);
  assert.throws(() => apply(s, step));
  s = apply(s, { type: "close", positionId: "p1" });
  assert.equal(s.wallet, 9000e6);
});
void test("close settles subminimum earnings and larger pending balances remain convertible", () => {
  let s = apply(apply(initialEarnState(), { ...open, amount: 10e6 }), step);
  s = apply(s, { type: "close", positionId: "p1" });
  assert.equal(s.positions[0].pending, 0);
  assert.ok(s.wallet > 10_000e6);
  let large = apply(apply(initialEarnState(), open), step);
  large = apply(large, { type: "close", positionId: "p1" });
  large = apply(large, { type: "convert", positionId: "p1" });
  assert.ok(large.holdings.NVDA);
  assert.throws(() => apply(large, { type: "compound", positionId: "p1" }));
});
void test("activity cap still permits completion", () => {
  let s = apply(apply(initialEarnState(), open), step);
  s.entries = Array.from({ length: 3900 }, (_, i) => ({ ...s.entries[0], id: i + 1 }));
  assert.throws(() => apply(s, step), /limit/);
  s = apply(s, { type: "convert", positionId: "p1" });
  s = apply(s, { type: "close", positionId: "p1" });
  assert.equal(s.positions[0].closed, true);
});
void test("extreme compounding stops before precision loss and preserves an exit", () => {
  let s = apply(initialEarnState(), {
    ...open,
    kind: "lp",
    amount: 10000e6,
    leverage: 3,
    feeApr: 100,
    compoundBps: 10000,
  });
  let rejected = false;
  for (let i = 0; i < 120; i++) {
    try {
      s = apply(s, step);
    } catch {
      rejected = true;
      break;
    }
  }
  assert.ok(rejected);
  s = apply(s, { type: "close", positionId: "p1" });
  assert.ok(Number.isSafeInteger(s.wallet));
});
void test("invalid commands, allocation duplicates, fabricated amounts and rates are rejected or ignored", () => {
  for (const v of [
    { ...open, amount: NaN },
    { ...open, amount: -1 },
    { ...open, amount: 1.5 },
    { ...open, compoundBps: 10001 },
    { ...open, allocation: [{ symbol: "NVDA", bps: 100 }] },
    {
      ...open,
      allocation: [
        { symbol: "NVDA", bps: 5000 },
        { symbol: "NVDA", bps: 5000 },
      ],
    },
    { ...open, allocation: [{ symbol: "FAKE", bps: 10000 }] },
    { ...step, days: 31 },
    { ...step, shockPct: 51 },
    { type: "live_deposit" },
  ])
    assert.throws(() => parseEarnCommand(v));
  const parsed = parseEarnCommand({ ...open, apy: 999, owner: "other", capital: 999 });
  assert.ok(!("apy" in parsed));
  assert.ok(!("owner" in parsed));
  assert.throws(() =>
    applyEarnCommand(initialEarnState(), open, {
      ...context,
      vault: { ...context.vault, apy: null },
    }),
  );
});
