import test from "node:test";
import assert from "node:assert/strict";
import {
  UNIT,
  DAY,
  PEERS,
  RuleError,
  initialState,
  parseAmount,
  parseCommand,
  applyCommand,
  checkInvariants,
  poolBalance,
  randomBelow,
  winnerAt,
  type Command,
  type State,
} from "../lib/engine.ts";

const zero = (_total: bigint) => 0n;
const initial = () => initialState("2026-09-08");
const amount = (dollars: bigint) => dollars * UNIT;

async function step(state: State, command: Command, pick = zero): Promise<State> {
  const next = await applyCommand(state, command, pick);
  checkInvariants(next);
  return next;
}

async function closedDraw(): Promise<State> {
  const state = await step(initial(), { type: "deposit", amount: "100" });
  return step(state, { type: "advance", days: 7 });
}

async function claimableDraw(): Promise<State> {
  let state = await closedDraw();
  state = await step(state, { type: "resolve", drawId: 1 });
  return step(state, { type: "settle_prize", drawId: 1 });
}

function withEventCount(state: State, count: number): State {
  const next = structuredClone(state);
  next.events = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    day: next.day,
    type: "test_history",
    amount: "0",
    detail: "Prior paper activity",
  }));
  checkInvariants(next);
  return next;
}

function assertConserved(state: State): void {
  assert.equal(
    BigInt(state.wallet) + BigInt(state.balance) + BigInt(state.pending),
    amount(10_000n),
  );
  assert.equal(
    BigInt(state.yieldGross),
    BigInt(state.costs) +
      BigInt(state.availableYield) +
      BigInt(state.reservedPrizes) +
      BigInt(state.paidPrizes),
  );
  checkInvariants(state);
}

void test("money parsing preserves exact micro-USDG and accepts the configured boundaries", async () => {
  assert.equal(parseAmount("0.000001"), 1n);
  assert.equal(parseAmount("0.29"), 290_000n);
  assert.equal(parseAmount("123.456789"), 123_456_789n);
  assert.equal(parseAmount("10000.000000"), amount(10_000n));
  assert.equal(parseAmount("00001.5"), 1_500_000n);
});

void test("money parsing rejects coercion, exponents, excess precision, invalid signs, and values outside bounds", async () => {
  for (const input of [
    1,
    0.1,
    1n,
    null,
    undefined,
    true,
    {},
    [],
    "",
    " ",
    " 1",
    "1 ",
    "-1",
    "+1",
    ".5",
    "1.",
    "0",
    "0.000000",
    "10000.000001",
    "10001",
    "1e2",
    "NaN",
    "Infinity",
    "1,000",
    "0.0000001",
    "123456789",
    "1\n",
    "１",
  ]) {
    assert.throws(() => parseAmount(input), RuleError, "accepted invalid amount");
  }
});

void test("command parsing accepts only the strict paper command schema", async () => {
  const valid: Command[] = [
    { type: "deposit", amount: "1.000001" },
    { type: "withdraw", amount: "1" },
    { type: "advance", days: 1 },
    { type: "advance", days: 7 },
    { type: "select_stock", stock: "NVDA" },
    { type: "complete_withdrawal" },
    { type: "resolve", drawId: 1 },
    { type: "settle_prize", drawId: 2 },
    { type: "claim", drawId: 3 },
  ];
  for (const command of valid) assert.deepEqual(parseCommand(command), command);
  const invalid: unknown[] = [
    null,
    false,
    [],
    "deposit",
    {},
    { type: "deposit" },
    { type: "deposit", amount: 1 },
    { type: "deposit", amount: "1", owner: "another-user" },
    { type: "deposit", amount: "1", state: initial() },
    { type: "advance", days: 0 },
    { type: "advance", days: 365 },
    { type: "advance", days: "7" },
    { type: "advance", days: 1.5 },
    { type: "advance", days: Infinity },
    { type: "select_stock", stock: "ETH" },
    { type: "select_stock", stock: "aapl" },
    { type: "claim", drawId: 0 },
    { type: "claim", drawId: -1 },
    { type: "claim", drawId: "1" },
    { type: "claim", drawId: NaN },
    { type: "claim", drawId: 1.1 },
    { type: "claim", drawId: Number.MAX_SAFE_INTEGER + 1 },
    { type: "resolve", drawId: 1, randomIndex: "0" },
    { type: "complete_withdrawal", amount: "1" },
    { type: "live_deposit", amount: "1" },
  ];
  for (const command of invalid) assert.throws(() => parseCommand(command), RuleError);
});

void test("initial paper capital is conserved and peer balances are separate from user capital", async () => {
  const state = initial();
  assertConserved(state);
  assert.equal(state.wallet, String(amount(10_000n)));
  assert.equal(state.balance, "0");
  assert.equal(state.yieldGross, "0");
  assert.equal(state.reservedPrizes, "0");
  assert.deepEqual(state.weights, ["0", "0", "0", "0", "0"]);
  assert.equal(
    poolBalance(state),
    PEERS.reduce((sum, peer) => sum + peer, 0n),
  );
});

void test("deposit moves paper capital only and never changes the input state", async () => {
  const original = initial();
  const before = structuredClone(original);
  const next = await step(original, { type: "deposit", amount: "123.456789" });
  assert.deepEqual(original, before);
  assert.equal(next.balance, "123456789");
  assert.equal(next.wallet, String(amount(10_000n) - 123_456_789n));
  assert.equal(next.yieldGross, "0");
  assert.equal(next.availableYield, "0");
  assert.equal(next.reservedPrizes, "0");
  assertConserved(next);
});

void test("invalid deposit or withdrawal fails atomically", async () => {
  const state = await step(initial(), { type: "deposit", amount: "100" });
  const before = structuredClone(state);
  await assert.rejects(applyCommand(state, { type: "deposit", amount: "10000" }), RuleError);
  await assert.rejects(applyCommand(state, { type: "withdraw", amount: "100.000001" }), RuleError);
  await assert.rejects(applyCommand(state, { type: "complete_withdrawal" }), RuleError);
  assert.deepEqual(state, before);
});

void test("withdrawal reserves capital; completion alone returns it to the paper wallet", async () => {
  let state = await step(initial(), { type: "deposit", amount: "100" });
  state = await step(state, { type: "advance", days: 1 });
  const earnedWeight = state.weights[0];
  const walletBefore = state.wallet;
  state = await step(state, { type: "withdraw", amount: "40" });
  assert.equal(state.balance, String(amount(60n)));
  assert.equal(state.pending, String(amount(40n)));
  assert.equal(state.wallet, walletBefore);
  assert.equal(state.weights[0], earnedWeight);
  const yieldBefore = state.yieldGross;
  state = await step(state, { type: "complete_withdrawal" });
  assert.equal(state.pending, "0");
  assert.equal(state.wallet, String(BigInt(walletBefore) + amount(40n)));
  assert.equal(state.yieldGross, yieldBefore);
  assertConserved(state);
  const beforeRetry = structuredClone(state);
  await assert.rejects(applyCommand(state, { type: "complete_withdrawal" }), RuleError);
  assert.deepEqual(state, beforeRetry);
});

void test("full-week versus last-day deposit receives seven times the entry weight", async () => {
  const full = await closedDraw();
  let late = initial();
  for (let day = 0; day < 6; day++) late = await step(late, { type: "advance", days: 1 });
  late = await step(late, { type: "deposit", amount: "100" });
  late = await step(late, { type: "advance", days: 1 });
  assert.equal(BigInt(full.draws[0].weights[0]), amount(100n) * DAY * 7n);
  assert.equal(BigInt(late.draws[0].weights[0]), amount(100n) * DAY);
  assert.equal(BigInt(full.draws[0].weights[0]), BigInt(late.draws[0].weights[0]) * 7n);
  assert.deepEqual(full.draws[0].weights.slice(1), late.draws[0].weights.slice(1));
});

void test("same-time deposit and withdrawal earns no user entries", async () => {
  let state = await step(initial(), { type: "deposit", amount: "10000" });
  state = await step(state, { type: "withdraw", amount: "10000" });
  state = await step(state, { type: "advance", days: 7 });
  assert.equal(state.draws[0].weights[0], "0");
  assert.equal(state.pending, String(amount(10_000n)));
  assert.equal(winnerAt(state.draws[0].weights, 0n), 1);
});

void test("a partial withdrawal stops only the removed amount from earning future entries", async () => {
  let state = await step(initial(), { type: "deposit", amount: "100" });
  state = await step(state, { type: "advance", days: 1 });
  state = await step(state, { type: "withdraw", amount: "40" });
  for (let day = 0; day < 6; day++) state = await step(state, { type: "advance", days: 1 });
  assert.equal(BigInt(state.draws[0].weights[0]), (amount(100n) + amount(60n) * 6n) * DAY);
  assert.equal(state.pending, String(amount(40n)));
});

void test("deposit at a closed boundary cannot gain entries in the closed draw", async () => {
  let state = await step(initial(), { type: "advance", days: 7 });
  const snapshot = structuredClone(state.draws[0]);
  state = await step(state, { type: "deposit", amount: "100" });
  assert.deepEqual(state.draws[0], snapshot);
  assert.equal(state.draws[0].weights[0], "0");
  assert.equal(state.weights[0], "0");
  state = await step(state, { type: "advance", days: 1 });
  assert.equal(BigInt(state.weights[0]), amount(100n) * DAY);
});

void test("closed snapshot, budget, and stock survive withdrawal and changed future stock preference", async () => {
  let state = await closedDraw();
  const snapshot = structuredClone(state.draws[0]);
  assert.match(snapshot.snapshot, /^[0-9a-f]{64}$/);
  state = await step(state, { type: "withdraw", amount: "100" });
  state = await step(state, { type: "complete_withdrawal" });
  state = await step(state, { type: "select_stock", stock: "MSFT" });
  assert.deepEqual(state.draws[0], snapshot);
  assert.equal(state.stock, "MSFT");
  state = await step(state, { type: "resolve", drawId: 1 });
  state = await step(state, { type: "settle_prize", drawId: 1 });
  state = await step(state, { type: "claim", drawId: 1 });
  assert.equal(state.holdings.AAPL, snapshot.amount);
  assert.equal(state.holdings.MSFT, undefined);
  assert.equal(state.balance, "0");
  assert.equal(state.wallet, String(amount(10_000n)));
});

void test("closing a draw reserves yield without consuming user principal", async () => {
  const state = await closedDraw();
  const draw = state.draws[0];
  assert.equal(draw.status, "closed");
  assert.equal(draw.amount, String(amount(10n)));
  assert.equal(state.balance, String(amount(100n)));
  assert.equal(state.wallet, String(amount(9_900n)));
  assert.equal(state.reservedPrizes, draw.amount);
  assert.equal(state.paidPrizes, "0");
  assert.equal(
    BigInt(state.availableYield),
    BigInt(state.yieldGross) - BigInt(state.costs) - BigInt(draw.amount),
  );
  assert.deepEqual(state.weights, ["0", "0", "0", "0", "0"]);
});

void test("weighted intervals handle boundaries and zero-weight participants correctly", async () => {
  const weights = ["0", "2", "0", "3", "0"];
  assert.equal(winnerAt(weights, 0n), 1);
  assert.equal(winnerAt(weights, 1n), 1);
  assert.equal(winnerAt(weights, 2n), 3);
  assert.equal(winnerAt(weights, 4n), 3);
  for (const index of [-1n, 5n, 100n]) assert.throws(() => winnerAt(weights, index), RuleError);
  assert.throws(() => winnerAt(["0", "0"], 0n), RuleError);
});

void test("sampling handles a single outcome and values above Number precision without converting to Number", async () => {
  assert.equal(randomBelow(1n), 0n);
  assert.throws(() => randomBelow(0n), RuleError);
  assert.throws(() => randomBelow(-1n), RuleError);
  const large = 2n ** 90n + 13n;
  for (let sample = 0; sample < 10; sample++) {
    const index = randomBelow(large);
    assert.equal(typeof index, "bigint");
    assert.ok(index >= 0n && index < large);
  }
  assert.equal(winnerAt([String(large), "1"], large - 1n), 0);
  assert.equal(winnerAt([String(large), "1"], large), 1);
});

void test("resolve stores randomness once; repeated resolution cannot reroll", async () => {
  let calls = 0;
  const state = await step(await closedDraw(), { type: "resolve", drawId: 1 }, (total) => {
    calls++;
    assert.ok(total > 0n);
    return 0n;
  });
  assert.equal(state.draws[0].status, "randomness_ready");
  assert.equal(state.draws[0].randomIndex, "0");
  assert.equal(state.draws[0].winner, 0);
  const repeated = await step(state, { type: "resolve", drawId: 1 }, () => {
    calls++;
    throw new Error("Reroll must never be requested");
  });
  assert.equal(calls, 1);
  assert.deepEqual(repeated, state);
});

void test("illegal settlement, premature claim, unknown draw, and invalid random output fail atomically", async () => {
  const state = await closedDraw();
  const before = structuredClone(state);
  await assert.rejects(applyCommand(state, { type: "settle_prize", drawId: 1 }), RuleError);
  await assert.rejects(applyCommand(state, { type: "claim", drawId: 1 }), RuleError);
  await assert.rejects(applyCommand(state, { type: "resolve", drawId: 999 }), RuleError);
  await assert.rejects(
    applyCommand(state, { type: "resolve", drawId: 1 }, (total) => total),
    RuleError,
  );
  await assert.rejects(
    applyCommand(state, { type: "resolve", drawId: 1 }, () => -1n),
    RuleError,
  );
  assert.deepEqual(state, before);
  const resolved = await step(state, { type: "resolve", drawId: 1 });
  await assert.rejects(applyCommand(resolved, { type: "claim", drawId: 1 }), RuleError);
});

void test("user prize remains reserved until exactly one claim moves it into holdings", async () => {
  const claimable = await claimableDraw();
  const prize = claimable.draws[0].amount;
  assert.equal(claimable.draws[0].status, "claimable");
  assert.equal(claimable.reservedPrizes, prize);
  assert.equal(claimable.paidPrizes, "0");
  assert.deepEqual(claimable.holdings, {});
  const claimed = await step(claimable, { type: "claim", drawId: 1 });
  assert.equal(claimed.draws[0].status, "claimed");
  assert.equal(claimed.reservedPrizes, "0");
  assert.equal(claimed.paidPrizes, prize);
  assert.equal(claimed.holdings.AAPL, prize);
  assert.equal(claimed.balance, claimable.balance);
  assert.equal(claimed.wallet, claimable.wallet);
  assert.equal(claimed.availableYield, claimable.availableYield);
  assert.deepEqual(await step(claimed, { type: "claim", drawId: 1 }), claimed);
  assert.deepEqual(await step(claimed, { type: "settle_prize", drawId: 1 }), claimed);
  assert.deepEqual(
    await step(claimed, { type: "resolve", drawId: 1 }, () => {
      throw Error("No reroll");
    }),
    claimed,
  );
});

void test("peer award settles exactly once and cannot be claimed by the user", async () => {
  let state = await closedDraw();
  state = await step(state, { type: "resolve", drawId: 1 }, (total) => total - 1n);
  assert.equal(state.draws[0].winner, 4);
  state = await step(state, { type: "settle_prize", drawId: 1 });
  assert.equal(state.draws[0].status, "settled");
  assert.equal(state.reservedPrizes, "0");
  assert.equal(state.paidPrizes, String(amount(10n)));
  assert.deepEqual(state.holdings, {});
  assert.deepEqual(await step(state, { type: "settle_prize", drawId: 1 }), state);
  await assert.rejects(applyCommand(state, { type: "claim", drawId: 1 }), RuleError);
});

void test("two draws resolve out of order against their own immutable entries", async () => {
  let state = await closedDraw();
  const firstSnapshot = state.draws[0].snapshot;
  state = await step(state, { type: "withdraw", amount: "100" });
  state = await step(state, { type: "advance", days: 7 });
  assert.equal(state.draws[1].weights[0], "0");
  state = await step(state, { type: "resolve", drawId: 2 });
  assert.equal(state.draws[1].winner, 1);
  assert.equal(state.draws[0].winner, undefined);
  state = await step(state, { type: "resolve", drawId: 1 });
  assert.equal(state.draws[0].winner, 0);
  assert.equal(state.draws[0].snapshot, firstSnapshot);
  assert.notEqual(state.draws[0].snapshot, state.draws[1].snapshot);
});

void test("daily versus weekly advancement yields the same financial state and draw snapshots", async () => {
  const deposited = await step(initial(), { type: "deposit", amount: "123.456789" });
  const weekly = await step(deposited, { type: "advance", days: 7 });
  let daily = deposited;
  for (let day = 0; day < 7; day++) daily = await step(daily, { type: "advance", days: 1 });
  for (const field of [
    "day",
    "balance",
    "wallet",
    "yieldGross",
    "costs",
    "yieldRemainder",
    "availableYield",
    "reservedPrizes",
    "paidPrizes",
  ] as const) {
    assert.equal(daily[field], weekly[field], `${field} changes with advancement batching`);
  }
  assert.deepEqual(daily.draws, weekly.draws);
  assert.deepEqual(daily.weights, weekly.weights);
});

void test("365-day boundary is exact and does not prevent completion of a previously earned allocation", async () => {
  let state = await step(initial(), { type: "deposit", amount: "100" });
  for (let week = 0; week < 52; week++) state = await step(state, { type: "advance", days: 7 });
  assert.equal(state.day, 364);
  assert.equal(state.draws.length, 52);
  const beforeOvershoot = structuredClone(state);
  await assert.rejects(applyCommand(state, { type: "advance", days: 7 }), RuleError);
  assert.deepEqual(state, beforeOvershoot);
  state = await step(state, { type: "advance", days: 1 });
  assert.equal(state.day, 365);
  assert.equal(BigInt(state.yieldGross), (poolBalance(state) * 4n) / 100n);
  await assert.rejects(applyCommand(state, { type: "advance", days: 1 }), RuleError);
  state = await step(state, { type: "resolve", drawId: 52 });
  state = await step(state, { type: "settle_prize", drawId: 52 });
  state = await step(state, { type: "claim", drawId: 52 });
  state = await step(state, { type: "withdraw", amount: "100" });
  state = await step(state, { type: "complete_withdrawal" });
  assert.equal(state.draws[51].status, "claimed");
  assert.equal(state.wallet, String(amount(10_000n)));
  assert.equal(state.day, 365);
  assertConserved(state);
});

void test("event cap preserves existing claim and withdrawal completion", async () => {
  let state = await claimableDraw();
  state = await step(state, { type: "withdraw", amount: "100" });
  state = withEventCount(state, 2000);
  await assert.rejects(applyCommand(state, { type: "deposit", amount: "1" }), RuleError);
  await assert.rejects(applyCommand(state, { type: "advance", days: 1 }), RuleError);
  await assert.rejects(applyCommand(state, { type: "select_stock", stock: "MSFT" }), RuleError);
  state = await step(state, { type: "claim", drawId: 1 });
  state = await step(state, { type: "complete_withdrawal" });
  assert.equal(state.pending, "0");
  assert.equal(state.wallet, String(amount(10_000n)));
  assert.equal(state.draws[0].status, "claimed");
  assert.deepEqual(await step(state, { type: "claim", drawId: 1 }), state);
  assertConserved(state);
});

void test("event cap permits finishing a closed draw through settlement", async () => {
  let state = withEventCount(await closedDraw(), 2000);
  state = await step(state, { type: "resolve", drawId: 1 });
  state = await step(state, { type: "settle_prize", drawId: 1 });
  state = await step(state, { type: "claim", drawId: 1 });
  assert.equal(state.draws[0].status, "claimed");
});

void test("an advance that would cross the event limit rejects atomically", async () => {
  const state = withEventCount(initial(), 1999);
  const before = structuredClone(state);
  await assert.rejects(applyCommand(state, { type: "advance", days: 7 }), RuleError);
  assert.deepEqual(state, before);
  const atLimit = await step(state, { type: "deposit", amount: "1" });
  assert.equal(atLimit.events.length, 2000);
  await assert.rejects(applyCommand(atLimit, { type: "withdraw", amount: "1" }), RuleError);
});

void test("invariant checker detects capital creation, unbacked prizes, and unearned holdings", async () => {
  const baseline = initial();
  const capital = structuredClone(baseline);
  capital.balance = "1";
  assert.throws(() => checkInvariants(capital), /Principal conservation/);
  const negative = structuredClone(baseline);
  negative.wallet = "-1";
  assert.throws(() => checkInvariants(negative), /Negative accounting/);
  const yieldMismatch = structuredClone(baseline);
  yieldMismatch.availableYield = "1";
  assert.throws(() => checkInvariants(yieldMismatch), /Yield conservation/);
  const reservation = await closedDraw();
  reservation.draws[0].amount = "1";
  assert.throws(() => checkInvariants(reservation), /Prize reservation/);
  const holdings = structuredClone(baseline);
  holdings.holdings.AAPL = "1";
  assert.throws(() => checkInvariants(holdings), /Holdings mismatch/);
});
