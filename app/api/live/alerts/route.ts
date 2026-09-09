import { env } from 'cloudflare:workers';
import { walletSession, authBody } from '../../../../lib/wallet-auth';
import {
  AuthError,
  requireWalletOwner,
} from '../../../../lib/wallet-auth-service';
import { json } from '../../../../lib/http';
import { db } from '../../../../lib/earn-store';
import { createPurchaseAlertStore } from '../../../../lib/live/purchase-alert-store';
import {
  createPushStore,
  pushConfig,
} from '../../../../lib/live/purchase-push';

async function scope(owner: unknown) {
  const session = await walletSession();
  if (!session) throw new AuthError('Connect your wallet to open alerts.');
  return {
    userId: session.userId,
    wallet: requireWalletOwner(session.userId, owner),
  };
}
const fail = (e: unknown) =>
  json(
    {
      error:
        e instanceof AuthError
          ? e.message
          : 'Alerts are temporarily unavailable. Try again.',
    },
    e instanceof AuthError ? e.status : 503,
  );
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams,
      s = await scope(q.get('owner')),
      database = db();
    const id = q.get('device') ?? '',
      config = pushConfig(env as unknown as Record<string, unknown>);
    return json({
      alerts: await createPurchaseAlertStore(database).list(s),
      publicKey: config?.publicKey ?? null,
      subscribed:
        /^[a-f0-9]{64}$/.test(id) &&
        (await createPushStore(database).subscribed(s, id)),
    });
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    const body = await authBody(request),
      s = await scope(body.owner),
      database = db();
    if (body.action === 'read' && typeof body.id === 'string') {
      await createPurchaseAlertStore(database).read(s, body.id);
    } else if (body.action === 'subscribe') {
      if (!pushConfig(env as unknown as Record<string, unknown>))
        throw new AuthError('Browser alerts are not configured yet.', 503);
      try {
        return json({
          device: await createPushStore(database).register(
            s,
            body.subscription,
          ),
        });
      } catch {
        throw new AuthError(
          'This subscription could not be saved. Use a supported browser; up to five browsers per wallet are supported.',
          400,
        );
      }
    } else if (
      body.action === 'unsubscribe' &&
      typeof body.device === 'string' &&
      /^[a-f0-9]{64}$/.test(body.device)
    ) {
      await createPushStore(database).remove(s, body.device);
    } else throw new AuthError('Choose a supported alert action.', 400);
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
