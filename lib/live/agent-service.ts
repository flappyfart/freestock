import { formatUnits } from 'ethers';
import {
  evaluateLending,
  planFingerprint,
  type AgentQuote,
} from './agentic-lending';
import { purchaseBudget } from './agent-settings';
import {
  createAgentStore,
  type AgentDatabase,
  type SavedAgentPlan,
  type SavedDecision,
} from './agent-store';
import { pilotSnapshot, preparePilot } from './pilot';
import { quoteAgentCosts } from './agent-prices';
import type { Prepared } from './wallet-transaction';

export async function inspectAgentPlan(
  saved: SavedAgentPlan,
): Promise<{ decision: SavedDecision; quote: AgentQuote | null }> {
  const { settings } = saved;
  const account = await pilotSnapshot(saved.wallet, saved.deployment);
  if (account.account.toLowerCase() !== saved.account.toLowerCase())
    throw Error('Saved account identity changed.');
  const base = evaluateLending({
    owner: saved.wallet,
    account,
    plan: settings.plan,
    now: Date.now(),
  });
  const decision = {
    ...base,
    block: account.block,
    checkedAt: new Date().toISOString(),
  };
  if (!base.canQuote) return { decision, quote: null };
  const amount = purchaseBudget(settings, account.spendableWithRoundingBuffer);
  const query = new URLSearchParams({
    owner: saved.wallet,
    deployment: saved.deployment,
    action: 'harvest',
    amount: formatUnits(amount, 6),
    allocations: JSON.stringify(settings.plan.allocations),
  });
  const prepared = (await preparePilot(saved.userId, query)) as Prepared;
  const quote = { prepared, fingerprint: planFingerprint(settings.plan) };
  let cost;
  try {
    cost = await quoteAgentCosts(prepared);
  } catch {
    return {
      decision: {
        ...decision,
        code: 'stale',
        title: 'Waiting for fee prices',
        reason:
          'The ETH and USDG price feeds could not support a current fee comparison. Your plan will wait and check again.',
        canQuote: false,
        canReview: false,
        error: true,
      },
      quote: null,
    };
  }
  const checkedAt = new Date().toISOString();
  if (cost.feeBps > settings.maximumCostBps)
    return {
      decision: {
        ...decision,
        cost,
        assets: amount.toString(),
        checkedAt,
        code: 'gas',
        title: 'Let more gains build up',
        reason: `Estimated network and pool fees exceed your ${settings.maximumCostBps / 100}% cost limit. No purchase is recommended.`,
        canQuote: false,
        canReview: false,
      },
      quote: null,
    };
  const assessed = evaluateLending({
    owner: saved.wallet,
    account,
    plan: settings.plan,
    quote,
    now: Date.now(),
  });
  return {
    decision: {
      ...assessed,
      cost,
      assets: amount.toString(),
      block: account.block,
      checkedAt,
    },
    quote: assessed.canReview ? quote : null,
  };
}
export async function checkAgentPlan(
  db: AgentDatabase,
  saved: SavedAgentPlan,
  source: 'manual' | 'background',
) {
  const store = createAgentStore(db),
    token = await store.claim(saved, saved.revision, source === 'manual');
  if (!token) return { busy: true, applied: false, quote: null };
  let result;
  try {
    result = await inspectAgentPlan(saved);
  } catch {
    result = {
      decision: {
        code: 'stale',
        title: 'Waiting for the next successful check',
        reason:
          'The chain or quote service could not complete this check. No transaction was sent; the next check will retry.',
        canQuote: false,
        canReview: false,
        error: true,
        checkedAt: new Date().toISOString(),
      } as SavedDecision,
      quote: null,
    };
  }
  const applied = await store.finish(saved, token, result.decision, source);
  // A paused, edited or removed plan invalidates work already in flight.
  return { busy: false, applied, quote: applied ? result.quote : null };
}
