import test from "node:test";
import assert from "node:assert/strict";
import { positionBudget } from "../lib/live/position-budget.ts";

void test("loss recovery becomes convertible only above the baseline and rounding reserve", () => {
  assert.deepEqual(positionBudget(100n, 80n), {
    surplus: 0n,
    shortfall: 20n,
    reserve: 0n,
    convertible: 0n,
  });
  assert.deepEqual(positionBudget(100n, 100n), {
    surplus: 0n,
    shortfall: 0n,
    reserve: 0n,
    convertible: 0n,
  });
  assert.deepEqual(
    [0n, 1n, 2n, 3n].map((gain) => positionBudget(100n, 100n + gain).convertible),
    [0n, 0n, 0n, 1n],
  );
});
void test("deposits do not create surplus; donations are surplus but are not classified as interest", () => {
  assert.equal(positionBudget(110n, 110n).surplus, 0n);
  assert.equal(positionBudget(100n, 110n).surplus, 10n);
  assert.throws(() => positionBudget(-1n, 100n));
});
void test("reserving and spending gains reduce the available conversion budget exactly", () => {
  const before = positionBudget(100n, 110n);
  const reserved = positionBudget(105n, 110n);
  const purchased = positionBudget(100n, 105n);
  assert.equal(before.convertible - reserved.convertible, 5n);
  assert.equal(before.convertible - purchased.convertible, 5n);
  assert.equal(positionBudget(100n, 0n).shortfall, 100n);
});
