export const STOCKS = [
  { symbol: "NVDA", name: "NVIDIA", modelPrice: 180 },
  { symbol: "AAPL", name: "Apple", modelPrice: 240 },
  { symbol: "MSFT", name: "Microsoft", modelPrice: 500 },
  { symbol: "TSLA", name: "Tesla", modelPrice: 350 },
  { symbol: "GOOGL", name: "Alphabet", modelPrice: 220 },
  { symbol: "SPY", name: "S&P 500 exposure", modelPrice: 650 },
] as const;
export type Stock = (typeof STOCKS)[number]["symbol"];
export type Allocation = { symbol: Stock; bps: number }[];
export type Position = {
  id: string;
  kind: "lend" | "lp";
  name: string;
  poolId: string;
  capital: number;
  pending: number;
  remainder: number;
  lossCarry: number;
  earned: number;
  converted: number;
  compounded: number;
  compoundBps: number;
  days: number;
  closed: boolean;
  allocation: Allocation;
  auto: boolean;
  threshold: number;
  apy: number;
  rateAsOf: string;
  rateSource: string;
  leverage: number;
  feeApr: number;
  borrowApr: number;
  costApr: number;
};
export type Purchase = { symbol: Stock; amount: number; quantity: number; price: number };
export type Entry = {
  id: number;
  at: string;
  positionId: string;
  action: string;
  amount: number;
  detail: string;
  purchases?: Purchase[];
};
export type EarnState = {
  schema: 1;
  wallet: number;
  nextId: number;
  positions: Position[];
  holdings: Partial<Record<Stock, { quantity: number; cost: number }>>;
  entries: Entry[];
};
export type Context = {
  at: string;
  vault: { id: string; name: string; apy: number | null; asOf: string; source: string };
};
export type EarnCommand =
  | {
      type: "open";
      kind: "lend" | "lp";
      amount: number;
      allocation: Allocation;
      auto: boolean;
      threshold: number;
      compoundBps: number;
      leverage: number;
      feeApr: number;
      borrowApr: number;
      costApr: number;
    }
  | { type: "advance"; positionId: string; days: number; shockPct: number }
  | { type: "convert" | "compound" | "close"; positionId: string }
  | {
      type: "configure";
      positionId: string;
      allocation: Allocation;
      auto: boolean;
      threshold: number;
      compoundBps: number;
    };
export class EarnError extends Error {}
function requireRule(value: unknown, message: string): asserts value {
  if (!value) throw new EarnError(message);
}
export function initialEarnState(): EarnState {
  return { schema: 1, wallet: 10_000_000_000, nextId: 1, positions: [], holdings: {}, entries: [] };
}
function bounded(value: unknown, min: number, max: number, label: string, integer = false): number {
  requireRule(
    typeof value === "number" &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (!integer || Number.isSafeInteger(value)),
    `Invalid ${label}.`,
  );
  return value;
}
export function allocation(value: unknown): Allocation {
  requireRule(
    Array.isArray(value) && value.length >= 1 && value.length <= STOCKS.length,
    "Choose one to six stock tokens.",
  );
  const result = value.map((v) => {
    requireRule(v && STOCKS.some((s) => s.symbol === v.symbol), "Unknown stock token.");
    return { symbol: v.symbol as Stock, bps: bounded(v.bps, 1, 10000, "basket weight", true) };
  });
  requireRule(
    new Set(result.map((v) => v.symbol)).size === result.length,
    "A stock token can appear only once.",
  );
  requireRule(result.reduce((s, v) => s + v.bps, 0) === 10000, "Basket weights must total 100%.");
  return result;
}
function preferences(v: Record<string, unknown>) {
  requireRule(typeof v.auto === "boolean", "Choose a conversion mode.");
  return {
    allocation: allocation(v.allocation),
    compoundBps: bounded(v.compoundBps, 0, 10000, "compounding percentage", true),
    auto: v.auto,
    threshold: bounded(v.threshold, 1_000_000, 1000_000_000, "conversion minimum", true),
  };
}
export function parseEarnCommand(value: unknown): EarnCommand {
  requireRule(value && typeof value === "object" && !Array.isArray(value), "Invalid action.");
  const v = value as Record<string, unknown>;
  if (v.type === "open") {
    requireRule(v.kind === "lend" || v.kind === "lp", "Choose lending or the LP model.");
    return {
      type: "open",
      kind: v.kind,
      amount: bounded(v.amount, 10_000_000, 10_000_000_000, "amount (minimum 10 USDG)", true),
      ...preferences(v),
      leverage: v.kind === "lp" ? bounded(v.leverage, 1, 3, "leverage") : 1,
      feeApr: v.kind === "lp" ? bounded(v.feeApr, 0, 100, "LP fee APR") : 0,
      borrowApr: v.kind === "lp" ? bounded(v.borrowApr, 0, 100, "borrowing APR") : 0,
      costApr: v.kind === "lp" ? bounded(v.costApr, 0, 100, "cost APR") : 0,
    };
  }
  requireRule(
    typeof v.positionId === "string" && /^p\d{1,5}$/.test(v.positionId),
    "Choose a position.",
  );
  if (v.type === "advance")
    return {
      type: "advance",
      positionId: v.positionId,
      days: bounded(v.days, 1, 30, "simulation days", true),
      shockPct: bounded(v.shockPct, -50, 50, "modeled LP value change"),
    };
  if (v.type === "close" || v.type === "convert" || v.type === "compound")
    return { type: v.type, positionId: v.positionId };
  if (v.type === "configure")
    return { type: "configure", positionId: v.positionId, ...preferences(v) };
  throw new EarnError("Unknown action.");
}
export function modeledNetApr(p: Pick<Position, "leverage" | "feeApr" | "borrowApr" | "costApr">) {
  return (p.feeApr - p.costApr) * p.leverage - p.borrowApr * (p.leverage - 1);
}
export function applyEarnCommand(input: EarnState, raw: EarnCommand, ctx: Context): EarnState {
  const command = parseEarnCommand(raw);
  const state = structuredClone(input);
  requireRule(
    state.entries.length < 3900 || ["close", "convert", "compound"].includes(command.type),
    "This demo account has reached its simulation limit. You can still convert earnings or close positions.",
  );
  const log = (
    p: Position,
    action: string,
    amount: number,
    detail: string,
    purchases?: Purchase[],
  ) =>
    state.entries.push({
      id: state.entries.length + 1,
      at: ctx.at,
      positionId: p.id,
      action,
      amount,
      detail,
      ...(purchases ? { purchases } : {}),
    });
  const convert = (p: Position) => {
    requireRule(p.pending >= 1_000_000, "At least 1 simulated USDG of earnings is needed.");
    requireRule(p.lossCarry === 0, "Previous losses must be recovered first.");
    const budget = p.pending;
    // Allocate integer micro-USDG exactly. Last destination receives the rounding remainder.
    let left = budget;
    const purchases = p.allocation.map((a, index) => {
      const amount =
        index === p.allocation.length - 1
          ? left
          : Number((BigInt(budget) * BigInt(a.bps)) / 10000n);
      left -= amount;
      const price = STOCKS.find((s) => s.symbol === a.symbol)!.modelPrice;
      const quantity = amount / 1e6 / price;
      const holding = state.holdings[a.symbol] ?? { quantity: 0, cost: 0 };
      state.holdings[a.symbol] = {
        quantity: holding.quantity + quantity,
        cost: holding.cost + amount,
      };
      return { symbol: a.symbol, amount, quantity, price };
    });
    p.pending = 0;
    p.converted += budget;
    log(
      p,
      "Stock conversion",
      budget,
      "Simulated purchase at fixed illustrative prices. Assumes 1 USDG = $1; no gas, spread or trading fees. No real trade.",
      purchases,
    );
  };
  if (command.type === "open") {
    requireRule(state.positions.length < 24, "Maximum 24 simulated positions.");
    requireRule(command.amount <= state.wallet, "Not enough simulated USDG.");
    if (command.kind === "lend")
      requireRule(
        ctx.vault.apy !== null &&
          Number.isFinite(ctx.vault.apy) &&
          ctx.vault.apy > -1 &&
          ctx.vault.apy <= 10,
        "A usable vault rate is unavailable. Try again later.",
      );
    const p: Position = {
      id: `p${state.nextId++}`,
      kind: command.kind,
      name: command.kind === "lend" ? ctx.vault.name : "Leveraged LP model",
      poolId: command.kind === "lend" ? ctx.vault.id : "lp-model",
      capital: command.amount,
      pending: 0,
      remainder: 0,
      lossCarry: 0,
      earned: 0,
      converted: 0,
      compounded: 0,
      compoundBps: command.compoundBps,
      days: 0,
      closed: false,
      allocation: command.allocation,
      auto: command.auto,
      threshold: command.threshold,
      apy: ctx.vault.apy ?? 0,
      rateAsOf: ctx.vault.asOf,
      rateSource: ctx.vault.source,
      leverage: command.leverage,
      feeApr: command.feeApr,
      borrowApr: command.borrowApr,
      costApr: command.costApr,
    };
    state.wallet -= command.amount;
    state.positions.push(p);
    log(
      p,
      "Simulated deposit",
      command.amount,
      p.kind === "lend"
        ? `Rate fixed for this scenario: ${(p.apy * 100).toFixed(4)}% seven-day historical APY, observed ${p.rateAsOf}.`
        : `Assumed ${p.leverage}× exposure; ${p.feeApr}% LP fee APR, ${p.borrowApr}% borrowing APR, ${p.costApr}% annual costs on exposure.`,
    );
    return state;
  }
  const p = state.positions.find((p) => p.id === command.positionId);
  requireRule(p, "Position not found.");
  if (command.type === "configure") {
    p.allocation = command.allocation;
    p.auto = command.auto;
    p.threshold = command.threshold;
    p.compoundBps = command.compoundBps;
    log(
      p,
      "Preferences changed",
      0,
      `Reinvest ${p.compoundBps / 100}% of new net earnings. Stock purchases: ${p.allocation.map((a) => `${a.symbol} ${a.bps / 100}%`).join(", ")}. ${p.auto ? `Auto-convert during simulation at ${p.threshold / 1e6} USDG.` : "Manual conversion."}`,
    );
  } else if (command.type === "convert") convert(p);
  else if (command.type === "compound") {
    requireRule(!p.closed && p.capital > 0, "Compounding needs an active position.");
    requireRule(p.pending > 0 && p.lossCarry === 0, "No available earnings to compound.");
    const amount = p.pending;
    p.capital += amount;
    p.compounded += amount;
    p.pending = 0;
    log(
      p,
      "Earnings compounded",
      amount,
      "Available simulated earnings reinvested into this position; no stock purchase.",
    );
  } else if (command.type === "close") {
    requireRule(!p.closed, "Position already closed.");
    state.wallet += p.capital;
    log(
      p,
      "Simulated withdrawal",
      p.capital,
      "Capital returned to the demo wallet. Earnings of at least 1 USDG remain available for conversion.",
    );
    p.capital = 0;
    p.closed = true;
    if (p.pending > 0 && p.pending < 1_000_000) {
      state.wallet += p.pending;
      log(
        p,
        "Residual earnings returned",
        p.pending,
        "Earnings below the conversion minimum returned to your demo wallet on closure.",
      );
      p.pending = 0;
    }
  } else if (command.type === "advance") {
    requireRule(!p.closed && p.capital > 0, "This position is closed or depleted.");
    requireRule(p.days + command.days <= 3650, "This scenario is limited to ten simulated years.");
    requireRule(
      p.kind === "lp" || command.shockPct === 0,
      "Price-shock modeling is available for LP positions only.",
    );
    const gross =
      p.kind === "lend"
        ? p.capital * (Math.pow(1 + p.apy, 1 / 365) - 1) * command.days
        : (((p.capital * modeledNetApr(p)) / 100) * command.days) / 365 +
          (p.capital * p.leverage * command.shockPct) / 100;
    let delta = Math.trunc(gross + p.remainder);
    p.remainder = gross + p.remainder - delta;
    requireRule(Number.isSafeInteger(delta), "Scenario exceeds the supported amount range.");
    // This simplified no-liquidation model floors equity at zero; a real route can liquidate earlier.
    delta = Math.max(delta, -p.capital - p.pending);
    p.earned += delta;
    p.days += command.days;
    let reinvested = 0;
    if (delta < 0) {
      const fromPending = Math.min(p.pending, -delta);
      p.pending -= fromPending;
      const capitalLoss = -delta - fromPending;
      p.capital -= capitalLoss;
      p.lossCarry += capitalLoss;
    } else {
      const recovery = Math.min(p.lossCarry, delta);
      p.lossCarry -= recovery;
      p.capital += recovery;
      const surplus = delta - recovery;
      const reinvest = Number((BigInt(surplus) * BigInt(p.compoundBps)) / 10000n);
      reinvested = reinvest;
      p.capital += reinvest;
      p.compounded += reinvest;
      p.pending += surplus - reinvest;
    }
    log(
      p,
      "Simulated earnings",
      delta,
      `${command.days} modeled days. ${p.kind === "lp" ? `LP value change ${command.shockPct}%; assumed net APR ${modeledNetApr(p).toFixed(2)}%. Re-establishes selected leverage each step without rebalancing costs; not a liquidation simulation.` : "Historical APY held constant; pending earnings earn no further interest."}`,
    );
    if (reinvested > 0)
      log(
        p,
        "Compounding rule applied",
        reinvested,
        `${p.compoundBps / 100}% of earnings after loss recovery reinvested at this simulation step. Total reinvested: ${(p.compounded / 1e6).toFixed(6)} USDG.`,
      );
    if (p.auto && p.compoundBps < 10000 && p.pending >= p.threshold && p.lossCarry === 0)
      convert(p);
  }
  const balances = [
    state.wallet,
    ...state.positions.flatMap((v) => [
      v.capital,
      v.pending,
      v.lossCarry,
      v.earned,
      v.converted,
      v.compounded,
    ]),
    ...Object.values(state.holdings).map((h) => h!.cost),
  ];
  requireRule(
    balances.every((v) => Number.isSafeInteger(v) && Math.abs(v) <= 1_000_000_000_000_000),
    "This scenario exceeds the simulated balance limit. Withdraw or use less extreme assumptions.",
  );
  requireRule(
    1_000_000_000_000_000 >=
      state.wallet +
        state.positions.reduce((n, v) => n + v.capital + v.pending, 0) +
        Object.values(state.holdings).reduce((n, h) => n + h!.cost, 0),
    "Simulated balance limit reached.",
  );
  return state;
}
