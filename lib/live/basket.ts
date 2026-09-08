import { STOCK_TOKENS, LiveError } from "./config.ts";
export const ENABLED_STOCKS = STOCK_TOKENS.filter((s) => s.symbol !== "MSFT");
export type Allocation = { symbol: string; weightBps: number };
export function allocateBasket(input: unknown, assets: bigint) {
  if (
    !Array.isArray(input) ||
    input.length < 1 ||
    input.length > ENABLED_STOCKS.length ||
    assets <= 0n
  )
    throw new LiveError("Choose one to five stocks for this purchase.", 400);
  const seen = new Set<string>();
  let sum = 0,
    used = 0n;
  const selections = input.map((v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw new LiveError("Invalid stock allocation.", 400);
    const a = v as Record<string, unknown>;
    const stock = ENABLED_STOCKS.find((s) => s.symbol === a.symbol);
    if (
      !stock ||
      seen.has(stock.symbol) ||
      typeof a.weightBps !== "number" ||
      !Number.isInteger(a.weightBps) ||
      a.weightBps <= 0 ||
      a.weightBps > 10000
    )
      throw new LiveError("Choose unique enabled stocks with positive percentages.", 400);
    seen.add(stock.symbol);
    sum += a.weightBps;
    return { ...stock, weightBps: a.weightBps };
  });
  if (sum !== 10000) throw new LiveError("Stock basket weights must total 100%.", 400);
  return selections.map((s, i) => {
    const amount =
      i === selections.length - 1 ? assets - used : (assets * BigInt(s.weightBps)) / 10000n;
    used += amount;
    if (amount <= 0n)
      throw new LiveError("The amount is too small for every selected basket leg.", 400);
    return { ...s, amount };
  });
}
