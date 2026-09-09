import test from "node:test";
import assert from "node:assert/strict";
import { AbiCoder, keccak256 } from "ethers";
import registry from "../lib/stock-lending-registry.json" with { type: "json" };
import { STOCK_TOKENS, USDG } from "../lib/live/config.ts";
import { decodeStockMarket, unavailableStockMarket } from "../lib/stock-lending-data.ts";
const market = registry.markets[0];
const state = (supply: string, borrow: string) => ({
  data: {
    chain_id: 4663,
    market_id: market.id,
    last_indexed_block: "58196418",
    total_supply_assets: supply,
    total_borrow_assets: borrow,
  },
});
const rates = (rate: unknown) => ({
  data: {
    chain_id: 4663,
    market_id: market.id,
    last_indexed_block: "58196420",
    supply_apy_averages: { "7d": rate },
  },
});
await test("all five market IDs bind canonical stock loan tokens and USDG collateral", () => {
  assert.equal(registry.markets.length, 5);
  for (const m of registry.markets) {
    assert.equal(m.loanToken, STOCK_TOKENS.find((s) => s.symbol === m.symbol)?.address);
    assert.equal(m.collateralToken, USDG);
    assert.equal(m.decimals, "18");
    const encoded = AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "address", "address", "uint256"],
      [m.loanToken, m.collateralToken, m.oracle, m.irm, m.lltv],
    );
    assert.equal(keccak256(encoded), m.id);
  }
});
await test("stock amounts retain 18-decimal precision and subtract borrow liquidity exactly", () => {
  const result = decodeStockMarket(market, state("1000000000000000001", "1"), rates(0.025));
  assert.equal(result.suppliedTokens, "1.000000000000000001");
  assert.equal(result.borrowedTokens, "0.000000000000000001");
  assert.equal(result.availableTokens, "1.0");
  assert.equal(result.supplyApy, 0.025);
  assert.equal(result.empty, false);
});
await test("empty markets have real zeros; unavailable data and rates never imply zero", () => {
  const empty = decodeStockMarket(market, state("0", "0"), rates(0));
  assert.equal(empty.empty, true);
  assert.equal(empty.supplyApy, 0);
  assert.equal(empty.availableTokens, "0.0");
  const missing = unavailableStockMarket(market);
  assert.equal(missing.suppliedTokens, null);
  assert.equal(missing.supplyApy, null);
  assert.equal(missing.empty, null);
  for (const response of [null, rates(null), rates("0"), rates(Infinity)]) {
    const result = decodeStockMarket(market, state("0", "0"), response);
    assert.equal(result.supplyApy, null);
    assert.equal(result.rateBlock, null);
  }
});
await test("wrong chain or market, invalid amounts and impossible liquidity fail closed", () => {
  const original = state("1", "0");
  for (const change of [
    { chain_id: 1 },
    { market_id: registry.markets[1].id },
    { total_supply_assets: -1 },
    { total_supply_assets: "1e18" },
    { total_supply_assets: "-1" },
    { total_borrow_assets: "2" },
    { last_indexed_block: "0" },
    { total_supply_assets: (1n << 256n).toString() },
  ])
    assert.throws(() =>
      decodeStockMarket(market, { data: { ...original.data, ...change } }, rates(0)),
    );
  const wrongRate = rates(0.05);
  wrongRate.data.market_id = registry.markets[1].id;
  assert.equal(decodeStockMarket(market, original, wrongRate).supplyApy, null);
});
