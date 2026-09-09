import { MaxUint256 } from 'ethers';
import {
  defaultAgentPlan,
  validateAgentPlan,
  type AgentPlan,
} from './agentic-lending.ts';

export type AgentSettings = {
  version: 1;
  plan: AgentPlan;
  monitoring: boolean;
  intervalMinutes: 15 | 60 | 360;
  maximumPurchase: string;
  maximumCostBps: number;
};
export const defaultAgentSettings: AgentSettings = {
  version: 1,
  plan: structuredClone(defaultAgentPlan),
  monitoring: false,
  intervalMinutes: 60,
  maximumPurchase: '25000000',
  maximumCostBps: 500,
};
export function validateAgentSettings(value: unknown): AgentSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Choose a valid lending plan.');
  const s = value as AgentSettings;
  if (
    s.version !== 1 ||
    typeof s.monitoring !== 'boolean' ||
    ![15, 60, 360].includes(s.intervalMinutes) ||
    typeof s.maximumPurchase !== 'string' ||
    !/^\d{1,78}$/.test(s.maximumPurchase) ||
    BigInt(s.maximumPurchase) < 1n ||
    BigInt(s.maximumPurchase) > MaxUint256 ||
    !Number.isSafeInteger(s.maximumCostBps) ||
    s.maximumCostBps < 5 ||
    s.maximumCostBps > 10000
  )
    throw Error(
      'Choose a positive purchase limit, a cost limit from 0.05% to 100%, and a supported check interval.',
    );
  const plan = validateAgentPlan(s.plan);
  if (
    plan.destination === 'stocks' &&
    BigInt(plan.minimumGains) > BigInt(s.maximumPurchase)
  )
    throw Error(
      'The purchase limit must be at least your minimum available gains.',
    );
  return {
    version: 1,
    plan,
    monitoring: s.monitoring,
    intervalMinutes: s.intervalMinutes,
    maximumPurchase: BigInt(s.maximumPurchase).toString(),
    maximumCostBps: s.maximumCostBps,
  };
}
export function purchaseBudget(settings: AgentSettings, available: string) {
  const amount = BigInt(available),
    maximum = BigInt(settings.maximumPurchase);
  return amount < maximum ? amount : maximum;
}
export type CostEstimate = {
  gasUsdg: string;
  poolFeesUsdg: string;
  totalFeesUsdg: string;
  feeBps: number;
  observedAt: string;
  expiresAt: string;
  ethUpdatedAt: string;
  usdgUpdatedAt: string;
  source: 'Chainlink ETH/USD and USDG/USD';
};
const ceil = (n: bigint, d: bigint) => (n + d - 1n) / d;
export function estimateCosts(input: {
  gasWei: bigint;
  assets: bigint;
  poolFees: bigint;
  ethPrice: bigint;
  usdgPrice: bigint;
  ethDecimals: number;
  usdgDecimals: number;
  now: number;
  ethUpdatedAt: number;
  usdgUpdatedAt: number;
}): CostEstimate {
  const {
    gasWei,
    assets,
    poolFees,
    ethPrice,
    usdgPrice,
    ethDecimals,
    usdgDecimals,
    now,
  } = input;
  if (
    gasWei < 0n ||
    assets <= 0n ||
    poolFees < 0n ||
    poolFees > assets ||
    ethPrice <= 0n ||
    usdgPrice <= 0n ||
    ![ethDecimals, usdgDecimals].every(
      (d) => Number.isInteger(d) && d >= 0 && d <= 18,
    )
  )
    throw Error('Invalid fee valuation.');
  const gas = ceil(
    gasWei * ethPrice * 10n ** BigInt(usdgDecimals) * 1_000_000n,
    10n ** 18n * usdgPrice * 10n ** BigInt(ethDecimals),
  );
  const total = gas + poolFees,
    bps = ceil(total * 10000n, assets);
  return {
    gasUsdg: gas.toString(),
    poolFeesUsdg: poolFees.toString(),
    totalFeesUsdg: total.toString(),
    feeBps: Number(bps > 1_000_000n ? 1_000_000n : bps),
    observedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 45000).toISOString(),
    ethUpdatedAt: new Date(input.ethUpdatedAt * 1000).toISOString(),
    usdgUpdatedAt: new Date(input.usdgUpdatedAt * 1000).toISOString(),
    source: 'Chainlink ETH/USD and USDG/USD',
  };
}
