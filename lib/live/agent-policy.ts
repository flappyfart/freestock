import { allocateBasket } from './basket.ts';
import type { SavedAgentPlan } from './agent-store.ts';
import type { Prepared } from './wallet-transaction.ts';
import type { CostEstimate } from './agent-settings.ts';
export function enforceAgentPolicy(
  saved: SavedAgentPlan,
  revision: number,
  prepared: Prepared,
  cost?: CostEstimate,
  now = Date.now(),
) {
  const { settings } = saved,
    p = settings.plan,
    amount = BigInt(prepared.assets);
  if (
    saved.revision !== revision ||
    p.paused ||
    p.destination !== 'stocks' ||
    prepared.action !== 'harvest' ||
    saved.wallet.toLowerCase() !== prepared.owner.toLowerCase() ||
    saved.account.toLowerCase() !== prepared.account?.toLowerCase() ||
    saved.deployment.toLowerCase() !== prepared.deployment?.toLowerCase() ||
    amount < BigInt(p.minimumGains) ||
    amount > BigInt(settings.maximumPurchase) ||
    BigInt(prepared.estimatedGasCostWei) > BigInt(p.maximumGasWei) ||
    !Number.isFinite(Date.parse(prepared.expiresAt)) ||
    Date.parse(prepared.expiresAt) <= now
  )
    throw Error(
      'This purchase no longer meets your saved lending plan. Return to Agentic Lending and check again.',
    );
  const legs = allocateBasket(p.allocations, amount);
  if (
    prepared.purchases?.length !== legs.length ||
    prepared.purchases.some(
      (leg, i) =>
        leg.symbol !== legs[i].symbol ||
        leg.weightBps !== legs[i].weightBps ||
        leg.amountIn !== legs[i].amount.toString(),
    )
  )
    throw Error('This purchase allocation differs from your saved plan.');
  if (
    cost &&
    (cost.feeBps > settings.maximumCostBps ||
      !Number.isFinite(Date.parse(cost.expiresAt)) ||
      Date.parse(cost.expiresAt) <= now)
  )
    throw Error('The refreshed fees exceed your plan limit or have expired.');
}
