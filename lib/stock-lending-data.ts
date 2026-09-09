import { formatUnits } from "ethers";

export type StockMarketDefinition = {
  id: string;
  symbol: string;
  loanToken: string;
  oracle: string;
};
export type StockLendingMarket = StockMarketDefinition & {
  collateral: "USDG";
  status: "live" | "unavailable";
  suppliedTokens: string | null;
  borrowedTokens: string | null;
  availableTokens: string | null;
  supplyApy: number | null;
  block: string | null;
  rateBlock: string | null;
  empty: boolean | null;
};
export type StockLendingCatalogue = {
  asOf: string;
  status: "live" | "partial" | "unavailable";
  executionEnabled: false;
  markets: StockLendingMarket[];
};

function row(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Missing market data");
  return value as Record<string, unknown>;
}
function uint(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,78}$/.test(value)) throw Error("Invalid market amount");
  const parsed = BigInt(value);
  if (parsed > (1n << 256n) - 1n) throw Error("Market amount overflow");
  return parsed;
}
function identity(value: unknown, definition: StockMarketDefinition) {
  const data = row(row(value).data);
  if (
    data.chain_id !== 4663 ||
    typeof data.market_id !== "string" ||
    data.market_id.toLowerCase() !== definition.id.toLowerCase() ||
    uint(data.last_indexed_block) <= 0n
  )
    throw Error("Market identity mismatch");
  return data;
}

export function unavailableStockMarket(definition: StockMarketDefinition): StockLendingMarket {
  return {
    id: definition.id,
    symbol: definition.symbol,
    loanToken: definition.loanToken,
    oracle: definition.oracle,
    collateral: "USDG",
    status: "unavailable",
    suppliedTokens: null,
    borrowedTokens: null,
    availableTokens: null,
    supplyApy: null,
    block: null,
    rateBlock: null,
    empty: null,
  };
}

export function decodeStockMarket(
  definition: StockMarketDefinition,
  stateResponse: unknown,
  rateResponse: unknown,
): StockLendingMarket {
  const state = identity(stateResponse, definition);
  const supplied = uint(state.total_supply_assets);
  const borrowed = uint(state.total_borrow_assets);
  if (borrowed > supplied) throw Error("Borrowed assets exceed market supply");
  let supplyApy: number | null = null;
  let rateBlock: string | null = null;
  // Rate metadata can fail independently; never replace missing rates with zero.
  if (rateResponse !== null) {
    try {
      const rates = identity(rateResponse, definition);
      const rate = row(rates.supply_apy_averages)["7d"];
      if (typeof rate === "number" && Number.isFinite(rate) && rate > -1 && rate <= 10) {
        supplyApy = rate;
        rateBlock = String(rates.last_indexed_block);
      }
    } catch {
      // Valid balances remain visible when historical rate data is unavailable.
    }
  }
  return {
    ...unavailableStockMarket(definition),
    status: "live",
    suppliedTokens: formatUnits(supplied, 18),
    borrowedTokens: formatUnits(borrowed, 18),
    availableTokens: formatUnits(supplied - borrowed, 18),
    supplyApy,
    block: String(state.last_indexed_block),
    rateBlock,
    empty: supplied === 0n && borrowed === 0n,
  };
}
