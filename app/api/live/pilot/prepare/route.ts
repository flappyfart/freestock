import {
  AuthError,
  requireWalletOwner,
} from '../../../../../lib/wallet-auth-service';
import { identity, json } from '../../../../../lib/http';
import { preparePilot } from '../../../../../lib/live/pilot';
import { db } from '../../../../../lib/earn-store';
import { createAgentStore } from '../../../../../lib/live/agent-store';
import { enforceAgentPolicy } from '../../../../../lib/live/agent-policy';
import { quoteAgentCosts } from '../../../../../lib/live/agent-prices';
import { LiveError } from '../../../../../lib/live/config';
export async function GET(request: Request) {
  const user = await identity();
  if (!user)
    return json(
      { error: 'Connect your wallet to use your live account.' },
      401,
    );
  const q = new URL(request.url).searchParams;
  try {
    requireWalletOwner(user, new URL(request.url).searchParams.get('owner'));
    const prepared = await preparePilot(user, q);
    if (q.has('agentRevision')) {
      const revision = Number(q.get('agentRevision'));
      const store = createAgentStore(db()),
        scope = {
          userId: user,
          wallet: prepared.owner,
          account: prepared.account ?? '',
        };
      const saved = await store.get(scope);
      if (!saved || !Number.isSafeInteger(revision))
        throw new AuthError('Reload your saved lending plan.', 409);
      try {
        enforceAgentPolicy(saved, revision, prepared);
        const cost = await quoteAgentCosts(prepared);
        const current = await store.get(scope);
        if (!current) throw Error('The saved plan was removed.');
        enforceAgentPolicy(current, revision, prepared, cost);
      } catch (e) {
        throw new AuthError(
          e instanceof Error ? e.message : 'Refresh your plan.',
          409,
        );
      }
    }
    return json(prepared);
  } catch (e) {
    return json(
      {
        error:
          e instanceof LiveError || e instanceof AuthError
            ? e.message
            : 'The chain could not complete this action preview. Check wallet funds, current liquidity and try again.',
      },
      e instanceof LiveError || e instanceof AuthError ? e.status : 503,
    );
  }
}
