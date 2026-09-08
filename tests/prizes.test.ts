import test from "node:test";
import assert from "node:assert/strict";
import { applyCommand, initialState, UNIT } from "../lib/engine.ts";
import { prizeSummary } from "../lib/prizes.ts";

void test("Home distinguishes a waiting user prize from completed awards to other savers", async () => {
  let state = await applyCommand(initialState(), { type: "deposit", amount: "100" });
  state = await applyCommand(state, { type: "advance", days: 7 });
  state = await applyCommand(state, { type: "advance", days: 7 });
  state = await applyCommand(state, { type: "resolve", drawId: 1 }, () => 0n);
  assert.equal(prizeSummary(state).readyToClaim, 0n, "An unprepared win is not claimable");
  state = await applyCommand(state, { type: "settle_prize", drawId: 1 });
  state = await applyCommand(state, { type: "resolve", drawId: 2 }, (total) => total - 1n);
  state = await applyCommand(state, { type: "settle_prize", drawId: 2 });
  let home = prizeSummary(state);
  assert.equal(state.paidPrizes, String(10n * UNIT), "Pool paid prizes belong to the other saver");
  assert.equal(home.claimed, 0n);
  assert.equal(home.readyToClaim, 10n * UNIT);
  assert.deepEqual(
    home.claimable.map((draw) => draw.id),
    [1],
  );
  const chart = structuredClone(state.points);
  state = await applyCommand(state, { type: "claim", drawId: 1 });
  state = JSON.parse(JSON.stringify(state));
  home = prizeSummary(state);
  assert.equal(home.claimed, 10n * UNIT);
  assert.equal(home.readyToClaim, 0n);
  assert.deepEqual(home.claimable, []);
  assert.equal(state.holdings.AAPL, String(10n * UNIT));
  assert.equal(state.balance, String(100n * UNIT));
  assert.deepEqual(state.points, chart, "Claimed stocks are not deposit-chart growth");
  state = await applyCommand(state, { type: "claim", drawId: 1 });
  assert.equal(prizeSummary(state).claimed, 10n * UNIT, "A repeated claim cannot inflate Home");
});

void test("Home sums separate won stocks while leaving another earned prize waiting", async () => {
  let state = await applyCommand(initialState(), { type: "deposit", amount: "100" });
  for (const [index, stock] of ["TSLA", "SPY", "TSLA"].entries()) {
    state = await applyCommand(state, { type: "select_stock", stock: stock as "TSLA" | "SPY" });
    state = await applyCommand(state, { type: "advance", days: 7 });
    state = await applyCommand(state, { type: "resolve", drawId: index + 1 }, () => 0n);
    state = await applyCommand(state, { type: "settle_prize", drawId: index + 1 });
    if (index < 2) state = await applyCommand(state, { type: "claim", drawId: index + 1 });
  }
  const home = prizeSummary(JSON.parse(JSON.stringify(state)));
  assert.equal(home.claimed, 20n * UNIT);
  assert.equal(home.readyToClaim, 10n * UNIT);
  assert.deepEqual(
    home.claimable.map((draw) => [draw.id, draw.stock]),
    [[3, "TSLA"]],
  );
  assert.deepEqual(state.holdings, { TSLA: String(10n * UNIT), SPY: String(10n * UNIT) });
});
