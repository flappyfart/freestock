/** Paper beta engine. Never sign, custody, route or represent real assets here. */
export const UNIT = 1_000_000n;
export const DAY = 86_400n;
export const PEERS = [8_000n, 12_000n, 5_000n, 7_500n].map((n) => n * UNIT);
export const STOCKS = ["AAPL", "NVDA", "MSFT", "TSLA", "GOOGL", "SPY"] as const;
export type Stock = (typeof STOCKS)[number];
export type Event = { id: number; day: number; type: string; amount: string; detail: string };
export type Draw = {
  id: number;
  day: number;
  stock: Stock;
  amount: string;
  weights: string[];
  snapshot: string;
  status: "unfunded" | "closed" | "randomness_ready" | "claimable" | "settled" | "claimed";
  randomIndex?: string;
  winner?: number;
};
export type State = {
  schema: 1;
  day: number;
  startDate: string;
  wallet: string;
  balance: string;
  pending: string;
  weights: string[];
  yieldGross: string;
  costs: string;
  availableYield: string;
  reservedPrizes: string;
  paidPrizes: string;
  yieldRemainder: string;
  holdings: Partial<Record<Stock, string>>;
  stock: Stock;
  draws: Draw[];
  events: Event[];
  points: { day: number; balance: string }[];
};
export type Command =
  | { type: "deposit"; amount: string }
  | { type: "withdraw"; amount: string }
  | { type: "advance"; days: 1 | 7 }
  | { type: "select_stock"; stock: Stock }
  | { type: "resolve" | "settle_prize" | "claim"; drawId: number }
  | { type: "complete_withdrawal" };
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}
const fail = (message: string): never => {
  throw new RuleError(message);
};
export function parseAmount(value: unknown): bigint {
  if (typeof value !== "string" || !/^\d{1,8}(\.\d{1,6})?$/.test(value))
    return fail("Enter an amount with at most 6 decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const n = BigInt(whole) * UNIT + BigInt(fraction.padEnd(6, "0"));
  if (n <= 0n || n > 10_000n * UNIT)
    return fail("Choose an amount between 0.000001 and 10,000 USDG.");
  return n;
}
export function parseCommand(raw: unknown): Command {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("Invalid action.");
  const r = raw as Record<string, unknown>;
  let keys: string[] = [];
  if (r.type === "deposit" || r.type === "withdraw") {
    keys = ["type", "amount"];
    parseAmount(r.amount);
  } else if (r.type === "advance") {
    keys = ["type", "days"];
    if (r.days !== 1 && r.days !== 7) return fail("Advance by 1 or 7 days.");
  } else if (r.type === "select_stock") {
    keys = ["type", "stock"];
    if (!STOCKS.includes(r.stock as Stock)) return fail("Choose a supported example stock.");
  } else if (r.type === "resolve" || r.type === "settle_prize" || r.type === "claim") {
    keys = ["type", "drawId"];
    if (!Number.isSafeInteger(r.drawId) || Number(r.drawId) < 1) return fail("Invalid draw.");
  } else if (r.type === "complete_withdrawal") keys = ["type"];
  else return fail("This action is unavailable. Real deposits are disabled.");
  if (Object.keys(r).some((k) => !keys.includes(k))) return fail("Unexpected action field.");
  return r as Command;
}
export function initialState(date = new Date().toISOString().slice(0, 10)): State {
  return {
    schema: 1,
    day: 0,
    startDate: date,
    wallet: String(10_000n * UNIT),
    balance: "0",
    pending: "0",
    weights: ["0", "0", "0", "0", "0"],
    yieldGross: "0",
    costs: "0",
    availableYield: "0",
    reservedPrizes: "0",
    paidPrizes: "0",
    yieldRemainder: "0",
    holdings: {},
    stock: "AAPL",
    draws: [],
    events: [],
    points: [{ day: 0, balance: "0" }],
  };
}
export function poolBalance(s: State) {
  return PEERS.reduce((a, b) => a + b, BigInt(s.balance));
}
export function randomBelow(total: bigint): bigint {
  if (total <= 0n) return fail("No entries in this draw.");
  const bytes = Math.ceil(total.toString(2).length / 8),
    range = 1n << BigInt(bytes * 8),
    limit = range - (range % total);
  for (;;) {
    const values = crypto.getRandomValues(new Uint8Array(bytes));
    const x = BigInt("0x" + Array.from(values, (b) => b.toString(16).padStart(2, "0")).join(""));
    if (x < limit) return x % total;
  }
}
export function winnerAt(weights: string[], index: bigint): number {
  const total = weights.reduce((a, b) => a + BigInt(b), 0n);
  if (index < 0n || index >= total) return fail("Random index is outside the snapshot.");
  let sum = 0n;
  for (let i = 0; i < weights.length; i++) {
    sum += BigInt(weights[i]);
    if (index < sum) return i;
  }
  return fail("No eligible winner.");
}
export async function digest(text: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
function log(s: State, type: string, amount: bigint, detail: string) {
  s.events.push({ id: s.events.length + 1, day: s.day, type, amount: String(amount), detail });
}
export function checkInvariants(s: State) {
  const balance = BigInt(s.balance),
    pending = BigInt(s.pending),
    wallet = BigInt(s.wallet);
  if (
    [
      balance,
      pending,
      wallet,
      BigInt(s.availableYield),
      BigInt(s.reservedPrizes),
      BigInt(s.paidPrizes),
    ].some((n) => n < 0n)
  )
    throw Error("Negative accounting balance");
  if (balance + pending + wallet !== 10_000n * UNIT) throw Error("Principal conservation failed");
  if (
    BigInt(s.yieldGross) !==
    BigInt(s.costs) + BigInt(s.availableYield) + BigInt(s.reservedPrizes) + BigInt(s.paidPrizes)
  )
    throw Error("Yield conservation failed");
  const reserved = s.draws
    .filter((d) => ["closed", "randomness_ready", "claimable"].includes(d.status))
    .reduce((n, d) => n + BigInt(d.amount), 0n);
  if (reserved !== BigInt(s.reservedPrizes)) throw Error("Prize reservation mismatch");
  const held = Object.values(s.holdings).reduce((n, x) => n + BigInt(x!), 0n);
  const claimed = s.draws
    .filter((d) => d.status === "claimed")
    .reduce((n, d) => n + BigInt(d.amount), 0n);
  if (held !== claimed) throw Error("Holdings mismatch");
}
export async function applyCommand(
  original: State,
  command: Command,
  pick: (n: bigint) => bigint = randomBelow,
): Promise<State> {
  const c = parseCommand(command),
    s: State = structuredClone(original);
  checkInvariants(s);
  const createsActivity = ["deposit", "withdraw", "advance", "select_stock"].includes(c.type);
  if (createsActivity && s.events.length >= 2000)
    return fail(
      "This preview has reached its action limit. Pending withdrawals and prizes can still be completed.",
    );
  if (c.type === "deposit") {
    const n = parseAmount(c.amount);
    if (n > BigInt(s.wallet)) return fail("Not enough simulated USDG in your demo wallet.");
    s.wallet = String(BigInt(s.wallet) - n);
    s.balance = String(BigInt(s.balance) + n);
    log(s, "deposit", n, "Added simulated USDG");
  } else if (c.type === "withdraw") {
    const n = parseAmount(c.amount);
    if (n > BigInt(s.balance)) return fail("Your withdrawal exceeds your available savings.");
    s.balance = String(BigInt(s.balance) - n);
    s.pending = String(BigInt(s.pending) + n);
    log(
      s,
      "withdrawal_requested",
      n,
      "Reserved for withdrawal. Future entries stop for this amount.",
    );
  } else if (c.type === "complete_withdrawal") {
    const n = BigInt(s.pending);
    if (n === 0n) return fail("There is no pending withdrawal.");
    s.pending = "0";
    s.wallet = String(BigInt(s.wallet) + n);
    log(
      s,
      "withdrawal_completed",
      n,
      "Returned to demo wallet. Simulation assumes full liquidity.",
    );
  } else if (c.type === "select_stock") {
    if (s.stock === c.stock) return s;
    s.stock = c.stock;
    log(s, "stock_selected", 0n, `${c.stock} selected for future example draws`);
  } else if (c.type === "advance") {
    if (s.day + c.days > 365) return fail("This preview supports up to 365 simulated days.");
    for (let i = 0; i < c.days; i++) {
      const principals = [BigInt(s.balance), ...PEERS];
      s.weights = s.weights.map((w, k) => String(BigInt(w) + principals[k] * DAY));
      // 4% hypothetical annual gross yield; exact fractional micro-USDG carried forward.
      const numerator = poolBalance(s) * 400n + BigInt(s.yieldRemainder),
        denominator = 10_000n * 365n;
      const gross = numerator / denominator,
        cost = gross / 10n;
      s.yieldRemainder = String(numerator % denominator);
      s.yieldGross = String(BigInt(s.yieldGross) + gross);
      s.costs = String(BigInt(s.costs) + cost);
      s.availableYield = String(BigInt(s.availableYield) + gross - cost);
      s.day++;
      s.points.push({ day: s.day, balance: s.balance });
      if (s.day % 7 === 0) {
        const amount = 10n * UNIT,
          funded = BigInt(s.availableYield) >= amount,
          id = s.draws.length + 1;
        const weights = [...s.weights],
          snapshot = await digest(
            JSON.stringify({
              version: 1,
              id,
              day: s.day,
              stock: s.stock,
              amount: String(amount),
              weights,
            }),
          );
        s.draws.push({
          id,
          day: s.day,
          stock: s.stock,
          amount: funded ? String(amount) : "0",
          weights,
          snapshot,
          status: funded ? "closed" : "unfunded",
        });
        if (funded) {
          s.availableYield = String(BigInt(s.availableYield) - amount);
          s.reservedPrizes = String(BigInt(s.reservedPrizes) + amount);
        }
        s.weights = ["0", "0", "0", "0", "0"];
        log(
          s,
          "draw_closed",
          funded ? amount : 0n,
          `Example draw ${id}: ${funded ? "entries frozen and prize reserved" : "not enough yield"}`,
        );
      }
    }
    log(s, "time_advanced", 0n, `Advanced ${c.days} simulated day${c.days === 1 ? "" : "s"}`);
  } else {
    const d = s.draws.find((x) => x.id === c.drawId);
    if (!d) return fail("Draw not found.");
    if (c.type === "resolve") {
      if (d.status !== "closed") {
        if (d.randomIndex !== undefined) return s;
        return fail("This draw cannot receive randomness.");
      }
      const total = d.weights.reduce((n, w) => n + BigInt(w), 0n),
        index = pick(total);
      d.winner = winnerAt(d.weights, index);
      d.randomIndex = String(index);
      d.status = "randomness_ready";
      log(s, "randomness_stored", 0n, `Example draw ${d.id}: simulated random result stored`);
    } else if (c.type === "settle_prize") {
      if (["claimable", "settled", "claimed"].includes(d.status)) return s;
      if (d.status !== "randomness_ready")
        return fail("Store a random result before settling this draw.");
      if (d.winner === 0) d.status = "claimable";
      else {
        d.status = "settled";
        s.reservedPrizes = String(BigInt(s.reservedPrizes) - BigInt(d.amount));
        s.paidPrizes = String(BigInt(s.paidPrizes) + BigInt(d.amount));
      }
      log(
        s,
        "prize_settled",
        BigInt(d.amount),
        `Example draw ${d.id}: ${d.winner === 0 ? "your simulated allocation is ready" : `example saver ${d.winner} won`}`,
      );
    } else if (c.type === "claim") {
      if (d.status === "claimed") return s;
      if (d.status !== "claimable" || d.winner !== 0)
        return fail("This allocation is not claimable by you.");
      d.status = "claimed";
      s.reservedPrizes = String(BigInt(s.reservedPrizes) - BigInt(d.amount));
      s.paidPrizes = String(BigInt(s.paidPrizes) + BigInt(d.amount));
      s.holdings[d.stock] = String(BigInt(s.holdings[d.stock] || "0") + BigInt(d.amount));
      log(s, "prize_claimed", BigInt(d.amount), `${d.stock} simulated allocation added`);
    }
  }
  if (c.type === "deposit" || c.type === "withdraw")
    s.points.push({ day: s.day, balance: s.balance });
  if (createsActivity && s.events.length > 2000)
    return fail("This action would exceed the preview activity limit.");
  checkInvariants(s);
  return s;
}
