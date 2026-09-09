import { allocateBasket, type Allocation } from "./basket.ts";
import { CHAIN_ID, VAULT } from "./config.ts";
import { positionBudget } from "./position-budget.ts";
import { validatePrepared, type Prepared } from "./wallet-transaction.ts";

export type AgentPlan = {
  version: 1;
  destination: "stocks" | "retain";
  allocations: Allocation[];
  minimumGains: string;
  maximumGasWei: string;
  paused: boolean;
};
export const defaultAgentPlan: AgentPlan = {
  version: 1,
  destination: "stocks",
  allocations: [{ symbol: "NVDA", weightBps: 10000 }],
  minimumGains: "1000000",
  maximumGasWei: "50000000000000",
  paused: false,
};
export type AgentAccount = {
  owner: string;
  account: string;
  deployment: string;
  chainId: number;
  vault: string;
  principal: string;
  assetValue: string;
  availableGains: string;
  spendableWithRoundingBuffer: string;
  block: number;
  blockTime: string;
  observedAt: string;
};
export type PilotReadState = {
  scope: string;
  account: AgentAccount | null;
  blocked: boolean;
  error: string | null;
};
export type AgentQuote = { prepared: Prepared; fingerprint: string };
export type AgentIntent = {
  id: string;
  scope: string;
  owner: string;
  account: string;
  deployment: string;
  amount: string;
  allocations: Allocation[];
  expiresAt: string;
};
export type AgentDecision = {
  code:
    | "paused"
    | "setup"
    | "busy"
    | "stale"
    | "invalid"
    | "loss"
    | "hold"
    | "accumulate"
    | "quote"
    | "gas"
    | "review";
  title: string;
  reason: string;
  canQuote: boolean;
  canReview: boolean;
};
const integer = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{1,30}$/.test(value)) throw Error("Invalid amount.");
  return BigInt(value);
};
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const fresh = (value: string, now: number) =>
  Number.isFinite(Date.parse(value)) &&
  Date.parse(value) <= now + 5000 &&
  now - Date.parse(value) <= 45000;
export function validateAgentPlan(input: unknown): AgentPlan {
  if (!input || typeof input !== "object") throw Error("Choose a lending plan.");
  const p = input as AgentPlan;
  if (
    p.version !== 1 ||
    !["stocks", "retain"].includes(p.destination) ||
    typeof p.paused !== "boolean"
  )
    throw Error("Invalid lending plan.");
  const minimum = integer(p.minimumGains),
    gas = integer(p.maximumGasWei);
  if (minimum < 1n || minimum > 100_000_000n || gas < 1n || gas > 1_000_000_000_000_000_000n)
    throw Error("Enter a conversion minimum up to 100 USDG and a positive gas limit up to 1 ETH.");
  allocateBasket(p.allocations, 100_000_000n);
  return {
    version: 1,
    destination: p.destination,
    minimumGains: minimum.toString(),
    maximumGasWei: gas.toString(),
    paused: p.paused,
    allocations: p.allocations.map((a) => ({ symbol: a.symbol, weightBps: a.weightBps })),
  };
}
export const planFingerprint = (plan: AgentPlan) => JSON.stringify(validateAgentPlan(plan));
export function agentPurchaseAmount(account: AgentAccount) {
  const available = integer(account.spendableWithRoundingBuffer);
  return available > 100_000_000n ? 100_000_000n : available;
}
export function accountIsFresh(account: AgentAccount, owner: string, now: number) {
  try {
    const budget = positionBudget(integer(account.principal), integer(account.assetValue));
    return (
      account.chainId === CHAIN_ID &&
      same(account.vault, VAULT) &&
      same(account.owner, owner) &&
      /^0x[\da-f]{40}$/i.test(account.account) &&
      /^0x[\da-f]{64}$/i.test(account.deployment) &&
      Number.isSafeInteger(account.block) &&
      account.block > 0 &&
      fresh(account.observedAt, now) &&
      fresh(account.blockTime, now) &&
      integer(account.availableGains) === budget.surplus &&
      integer(account.spendableWithRoundingBuffer) === budget.convertible
    );
  } catch {
    return false;
  }
}
export function evaluateLending(input: {
  owner: string;
  account: AgentAccount | null;
  plan: AgentPlan;
  blocked?: boolean;
  readError?: string | null;
  quote?: AgentQuote | null;
  now: number;
}): AgentDecision {
  const decision = (code: AgentDecision["code"], title: string, reason: string): AgentDecision => ({
    code,
    title,
    reason,
    canQuote: code === "quote",
    canReview: code === "review",
  });
  let plan: AgentPlan;
  try {
    plan = validateAgentPlan(input.plan);
  } catch (e) {
    return decision(
      "invalid",
      "Complete your plan",
      e instanceof Error ? e.message : "Check your settings.",
    );
  }
  if (plan.paused)
    return decision(
      "paused",
      "Recommendations paused",
      "Resume when you want this plan checked again. Pausing does not change your position or any wallet transaction.",
    );
  if (input.blocked)
    return decision(
      "busy",
      "Finish your current action",
      "A position check, transaction review or pending wallet action is in progress. It takes priority over new recommendations.",
    );
  if (input.readError)
    return decision(
      "stale",
      "Refresh your position",
      "The latest position check was unsuccessful. A saved balance cannot support a new recommendation.",
    );
  const account = input.account;
  if (!account)
    return decision(
      "setup",
      "Start with a lending position",
      "Create or restore your Freestock USDG position to receive recommendations from its verified balances.",
    );
  if (!accountIsFresh(account, input.owner, input.now))
    return decision(
      "stale",
      "Waiting for fresh account data",
      "Account identity, balances and chain time must pass before this plan can recommend a purchase.",
    );
  const budget = positionBudget(BigInt(account.principal), BigInt(account.assetValue));
  if (BigInt(account.principal) === 0n && BigInt(account.assetValue) === 0n)
    return decision(
      "setup",
      "Fund your lending position",
      "Your account is ready, but no USDG is invested yet. Open Your position to review a deposit before looking for earnings.",
    );
  if (budget.shortfall > 0n)
    return decision(
      "loss",
      "Let the position recover",
      "The position is below its principal baseline. Recovery must come before new stock purchases.",
    );
  if (plan.destination === "retain")
    return decision(
      "hold",
      "Keep gains invested",
      "Your vault shares already accumulate underlying returns. Holding them needs no transaction; surplus remains available above the existing baseline.",
    );
  if (budget.convertible < BigInt(plan.minimumGains))
    return decision(
      "accumulate",
      "Wait for more available gains",
      "The spendable surplus is below your conversion minimum. Check again after more gains accrue.",
    );
  const quote = input.quote;
  if (!quote)
    return decision(
      "quote",
      "Check the cost of a stock purchase",
      "Your conversion minimum is met. Get a fresh basket quote and complete-transaction gas estimate before considering a purchase.",
    );
  try {
    const p = quote.prepared;
    const purchaseAmount = integer(p.assets);
    if (
      quote.fingerprint !== planFingerprint(plan) ||
      p.action !== "harvest" ||
      p.deployment?.toLowerCase() !== account.deployment.toLowerCase() ||
      purchaseAmount < BigInt(plan.minimumGains) ||
      purchaseAmount > agentPurchaseAmount(account)
    )
      throw Error();
    const legs = allocateBasket(plan.allocations, purchaseAmount);
    if (
      !p.purchases ||
      p.purchases.length !== legs.length ||
      p.purchases.some(
        (p, i) =>
          p.symbol !== legs[i].symbol ||
          p.weightBps !== legs[i].weightBps ||
          p.amountIn !== legs[i].amount.toString(),
      )
    )
      throw Error();
    if (
      p.purchases.some(
        (p) =>
          !p.observedAt ||
          !fresh(p.observedAt, input.now) ||
          !p.expiresAt ||
          Date.parse(p.expiresAt) <= input.now ||
          !Number.isFinite(Date.parse(p.expiresAt)),
      )
    )
      throw Error();
    if (!same(p.owner, input.owner) || !p.account || !same(p.account, account.account))
      throw Error();
    if (!Number.isFinite(Date.parse(p.expiresAt)) || Date.parse(p.expiresAt) <= input.now)
      throw Error();
    if (!p.hasGasBalance || !p.canSubmit)
      return decision(
        "gas",
        "Add ETH before considering this purchase",
        "Your wallet cannot cover the current network-fee estimate. No purchase is recommended.",
      );
    validatePrepared(p, input.owner, account.account, input.now);
    if (integer(p.estimatedGasCostWei) > BigInt(plan.maximumGasWei))
      return decision(
        "gas",
        "Wait for a lower network fee",
        "The estimated network fee is above your chosen ETH limit. Your gains remain in the account.",
      );
    return decision(
      "review",
      "Review your stock purchase",
      "The available surplus and estimated ETH network fee meet your plan. Check the fresh final quote in Your position before approving anything.",
    );
  } catch {
    return decision(
      "quote",
      "Refresh the purchase estimate",
      "The estimate has expired or no longer matches your position and selected allocation.",
    );
  }
}
export function validateAgentIntent(
  intent: AgentIntent,
  scope: string,
  account: AgentAccount | null,
  owner: string,
  now: number,
) {
  if (
    !account ||
    !accountIsFresh(account, owner, now) ||
    intent.scope !== scope ||
    !same(intent.owner, owner) ||
    !same(intent.account, account.account) ||
    !same(intent.deployment, account.deployment) ||
    !Number.isFinite(Date.parse(intent.expiresAt)) ||
    Date.parse(intent.expiresAt) <= now ||
    Date.parse(intent.expiresAt) > now + 60000 ||
    integer(intent.amount) <= 0n ||
    integer(intent.amount) > agentPurchaseAmount(account)
  )
    throw Error("This recommendation no longer matches the active position. Check the plan again.");
  allocateBasket(intent.allocations, BigInt(intent.amount));
}
