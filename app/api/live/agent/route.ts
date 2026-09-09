import { walletSession, authBody } from '../../../../lib/wallet-auth';
import {
  AuthError,
  requireWalletOwner,
} from '../../../../lib/wallet-auth-service';
import { json } from '../../../../lib/http';
import { db } from '../../../../lib/earn-store';
import {
  createAgentStore,
  AgentStoreError,
} from '../../../../lib/live/agent-store';
import { validateAgentSettings } from '../../../../lib/live/agent-settings';
import { pilotSnapshot } from '../../../../lib/live/pilot';
import { checkAgentPlan } from '../../../../lib/live/agent-service';
import { getAddress } from 'ethers';

async function scope(owner: unknown, account: unknown) {
  const session = await walletSession();
  if (!session)
    throw new AuthError('Connect your wallet to open your lending plan.');
  const wallet = requireWalletOwner(session.userId, owner);
  let address;
  try {
    address = getAddress(String(account));
  } catch {
    throw new AuthError('Choose a valid lending position.', 400);
  }
  return { userId: session.userId, wallet, account: address };
}
const fail = (error: unknown) =>
  json(
    {
      error:
        error instanceof AuthError || error instanceof AgentStoreError
          ? error.message
          : 'Your lending plan is temporarily unavailable. Try again.',
    },
    error instanceof AuthError || error instanceof AgentStoreError
      ? error.status
      : 503,
  );
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams,
      s = await scope(q.get('owner'), q.get('account')),
      store = createAgentStore(db());
    return json({ saved: await store.get(s), history: await store.history(s) });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  try {
    const body = await authBody(request),
      s = await scope(body.owner, body.account),
      store = createAgentStore(db());
    if (body.action === 'save') {
      let settings;
      try {
        settings = validateAgentSettings(body.settings);
      } catch (error) {
        throw new AuthError(
          error instanceof Error ? error.message : 'Check your plan.',
          400,
        );
      }
      if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0)
        throw new AuthError('Reload your saved plan.', 400);
      const existing = await store.get(s);
      // Existing ownership was verified at creation. Pausing must work even during an RPC outage.
      const account =
        existing &&
        existing.deployment.toLowerCase() ===
          String(body.deployment).toLowerCase()
          ? { account: existing.account, deployment: existing.deployment }
          : await pilotSnapshot(s.wallet, String(body.deployment));
      if (account.account.toLowerCase() !== s.account.toLowerCase())
        throw new AuthError(
          'This position does not match the connected wallet.',
          403,
        );
      const saved = await store.save(
        s,
        account.deployment,
        settings,
        Number(body.revision),
      );
      return json({ saved, history: await store.history(s) });
    }
    const saved = await store.get(s);
    if (!saved) throw new AuthError('Save a lending plan first.', 404);
    if (body.revision !== saved.revision)
      throw new AgentStoreError(
        'This plan changed on another device. Reload it first.',
      );
    if (body.action === 'remove') {
      await store.remove(s, saved.revision);
      return json({ saved: null, history: [] });
    }
    if (body.action === 'check') {
      const result = await checkAgentPlan(db(), saved, 'manual');
      return json(
        {
          ...result,
          saved: await store.get(s),
          history: await store.history(s),
        },
        result.busy ? 429 : result.applied ? 200 : 409,
      );
    }
    throw new AuthError('Choose a supported plan action.', 400);
  } catch (error) {
    return fail(error);
  }
}
