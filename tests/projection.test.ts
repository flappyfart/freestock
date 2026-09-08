import test from "node:test";
import assert from "node:assert/strict";
import { prizeProjection } from "../lib/prize-projection.ts";

void test("hypothetical pool growth scales the prize budget and dilutes a fixed $100 entry", () => {
  assert.deepEqual(prizeProjection(100_000), { weeklyPrize: 69, oneInOdds: 1000 });
  assert.deepEqual(prizeProjection(1_000_000), { weeklyPrize: 690, oneInOdds: 10000 });
  assert.deepEqual(prizeProjection(10_000_000), { weeklyPrize: 6904, oneInOdds: 100000 });
});
