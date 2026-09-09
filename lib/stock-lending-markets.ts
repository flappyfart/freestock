import registry from "./stock-lending-registry.json";
import {
  decodeStockMarket,
  unavailableStockMarket,
  type StockLendingCatalogue,
} from "./stock-lending-data";

let cache: { savedAt: number; value: StockLendingCatalogue } | undefined;
async function fetchMarket(id: string, resource: "state" | "apy-averages"): Promise<unknown> {
  // URLs come only from the checked registry, never from request parameters.
  const response = await fetch(`https://api.morpho.org/v0/blue/markets/4663:${id}/${resource}`, {
    headers: { Accept: "application/json" },
    redirect: "manual",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw Error("Stock market data unavailable");
  return response.json();
}

export async function stockLendingCatalogue(): Promise<StockLendingCatalogue> {
  const ttl = cache?.value.status === "live" ? 60000 : 15000;
  if (cache && Date.now() - cache.savedAt < ttl) return cache.value;
  // Keep fetch promises within the current Worker request; cache only completed data.
  const markets = await Promise.all(
    registry.markets.map(async (market) => {
      const [state, rates] = await Promise.allSettled([
        fetchMarket(market.id, "state"),
        fetchMarket(market.id, "apy-averages"),
      ]);
      try {
        if (state.status !== "fulfilled") return unavailableStockMarket(market);
        return decodeStockMarket(
          market,
          state.value,
          rates.status === "fulfilled" ? rates.value : null,
        );
      } catch {
        return unavailableStockMarket(market);
      }
    }),
  );
  const complete = markets.every((market) => market.status === "live" && market.supplyApy !== null);
  const unavailable = markets.every((market) => market.status === "unavailable");
  const value: StockLendingCatalogue = {
    asOf: new Date().toISOString(),
    status: complete ? "live" : unavailable ? "unavailable" : "partial",
    executionEnabled: false,
    markets,
  };
  cache = { savedAt: Date.now(), value };
  return value;
}
