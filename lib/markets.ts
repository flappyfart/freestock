import snapshot from "./market-snapshot.json";
export const VAULT = "0xBeEff033F34C046626B8D0A041844C5d1A5409dd";
const base = "https://api.morpho.org";
export type MarketCatalogue = {
  status: "live" | "snapshot";
  asOf: string;
  note: string;
  vault: {
    id: string;
    name: string;
    apy: number | null;
    assets: number;
    liquidity: number;
    asOf: string;
    source: string;
    block: string;
  };
  markets: {
    id: string;
    collateral: string;
    apy: number | null;
    assets: number;
    liquidity: number;
    block: string;
  }[];
};
export async function fetchMorpho(path: string) {
  const response = await fetch(base + path, {
    signal: AbortSignal.timeout(4500),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw Error("Market data unavailable");
  return response.json() as Promise<{ data: Record<string, unknown> }>;
}
function amount(v: unknown): number {
  if (typeof v !== "string" || !/^\d+$/.test(v)) throw Error("Missing market amount");
  const n = Number(v) / 1e6;
  if (!Number.isFinite(n)) throw Error("Invalid amount");
  return n;
}
function rate(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > -1 && v <= 10 ? v : null;
}
const fallback: MarketCatalogue = {
  status: "snapshot",
  asOf: snapshot.snapshot_fetched_at,
  note: "Saved September 8 snapshot. Live refresh is unavailable; figures may have changed.",
  vault: {
    id: VAULT,
    name: "Steakhouse USDG",
    apy: 0.0376737758134109,
    assets: 445275359.488137,
    liquidity: 30051328.71873,
    asOf: snapshot.snapshot_fetched_at,
    source: "Saved Morpho API snapshot",
    block: "58032495",
  },
  markets: snapshot.markets.map((m) => ({
    id: m.market_id,
    collateral: m.collateral_symbol,
    apy: m.supply_apy_7d,
    assets: m.total_supply_usdg,
    liquidity: m.available_liquidity_usdg,
    block: m.last_indexed_block,
  })),
};
let cached: { at: number; value: MarketCatalogue } | undefined;
let inflight: Promise<MarketCatalogue> | undefined;
async function refresh(): Promise<MarketCatalogue> {
  try {
    const responses = await Promise.all([
      fetchMorpho(`/v1/vaults-v2/4663:${VAULT}/state`),
      fetchMorpho(`/v1/vaults-v2/4663:${VAULT}/apy-averages?lookback=seven_days`),
      ...snapshot.markets.flatMap((m) => [
        fetchMorpho(`/v0/blue/markets/4663:${m.market_id}/state`),
        fetchMorpho(`/v0/blue/markets/4663:${m.market_id}/apy-averages`),
      ]),
    ]);
    const now = new Date().toISOString(),
      state = responses[0].data;
    if (
      String(state.address).toLowerCase() !== VAULT.toLowerCase() ||
      Number(state.chain_id) !== 4663
    )
      throw Error("Vault identity mismatch");
    return {
      status: "live",
      asOf: now,
      note: "Morpho API · seven-day historical rates · rewards excluded",
      vault: {
        id: VAULT,
        name: "Steakhouse USDG",
        apy: rate(responses[1].data.apy),
        assets: amount(state.total_assets),
        liquidity: amount(state.withdrawable_assets),
        asOf: now,
        source: "Live Morpho API",
        block: String(state.last_indexed_block),
      },
      markets: snapshot.markets.map((m, i) => {
        const s = responses[2 + i * 2].data,
          a = responses[3 + i * 2].data;
        if (String(s.market_id).toLowerCase() !== m.market_id || Number(s.chain_id) !== 4663)
          throw Error("Market identity mismatch");
        const supply = amount(s.total_supply_assets),
          borrowed = amount(s.total_borrow_assets);
        return {
          id: m.market_id,
          collateral: m.collateral_symbol,
          apy: rate((a.supply_apy_averages as Record<string, unknown> | undefined)?.["7d"]),
          assets: supply,
          liquidity: Math.max(0, supply - borrowed),
          block: String(s.last_indexed_block),
        };
      }),
    };
  } catch {
    return structuredClone(fallback);
  }
}
export async function catalogue(): Promise<MarketCatalogue> {
  if (cached && Date.now() - cached.at < (cached.value.status === "live" ? 60000 : 15000))
    return cached.value;
  if (!inflight)
    inflight = refresh()
      .then((value) => {
        cached = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        inflight = undefined;
      });
  return inflight;
}
