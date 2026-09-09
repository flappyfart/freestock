import {
  buildPushPayload,
  type PushSubscription,
  type VapidKeys,
} from '@block65/webcrypto-web-push';
import { getAddress } from 'ethers';
import type { AgentDatabase } from './agent-store.ts';
import type { AlertOwner } from './purchase-alert-store.ts';

const values = (s: AlertOwner) => [
  s.userId,
  getAddress(s.wallet).toLowerCase(),
];
export function validateSubscription(input: unknown): PushSubscription {
  if (!input || typeof input !== 'object')
    throw Error('Invalid browser subscription.');
  const s = input as PushSubscription;
  if (typeof s.endpoint !== 'string' || s.endpoint.length > 2048)
    throw Error('Invalid push endpoint.');
  const url = new URL(s.endpoint),
    host = url.hostname;
  const allowed =
    host === 'fcm.googleapis.com' ||
    host === 'updates.push.services.mozilla.com' ||
    /^[a-z0-9-]+\.push\.apple\.com$/.test(host) ||
    /^[a-z0-9.-]+\.notify\.windows\.com$/.test(host);
  if (
    !allowed ||
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname === '/'
  )
    throw Error('This browser push service is not supported.');
  const decode = (key: unknown, length: number) => {
    if (
      typeof key !== 'string' ||
      !/^[A-Za-z0-9_-]+={0,2}$/.test(key) ||
      key.length > 90
    )
      throw Error('Invalid subscription key.');
    const bytes = Uint8Array.from(
      atob(key.replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    );
    if (bytes.length !== length) throw Error('Invalid subscription key.');
    return bytes;
  };
  if (decode(s.keys?.p256dh, 65)[0] !== 4)
    throw Error('Invalid subscription key.');
  decode(s.keys?.auth, 16);
  if (
    s.expirationTime !== null &&
    s.expirationTime !== undefined &&
    (!Number.isFinite(s.expirationTime) || s.expirationTime < 0)
  )
    throw Error('Invalid subscription expiry.');
  return {
    endpoint: url.href,
    expirationTime: s.expirationTime ?? null,
    keys: { p256dh: s.keys.p256dh, auth: s.keys.auth },
  };
}
export async function subscriptionId(endpoint: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export function createPushStore(
  db: AgentDatabase,
  clock = () => Math.floor(Date.now() / 1000),
) {
  return {
    async subscribed(s: AlertOwner, id: string) {
      return !!(await db
        .prepare(
          'SELECT id FROM push_subscriptions WHERE id=? AND user_id=? AND wallet=?',
        )
        .bind(id, ...values(s))
        .first());
    },
    async register(s: AlertOwner, input: unknown) {
      const subscription = validateSubscription(input);
      // Also validate the point before accepting a device that could never receive a message.
      const key = Uint8Array.from(
        atob(subscription.keys.p256dh.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      );
      await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [],
      );
      const id = await subscriptionId(subscription.endpoint),
        now = clock(),
        version = crypto.randomUUID();
      const result = await db
        .prepare(`INSERT INTO push_subscriptions(id,user_id,wallet,subscription,version,created_at,updated_at)
        SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM push_subscriptions WHERE user_id=? AND wallet=?)<5 OR EXISTS(SELECT 1 FROM push_subscriptions WHERE id=? AND user_id=? AND wallet=?)
        ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,wallet=excluded.wallet,subscription=excluded.subscription,version=excluded.version,created_at=excluded.created_at,updated_at=excluded.updated_at RETURNING id`)
        .bind(
          id,
          ...values(s),
          JSON.stringify(subscription),
          version,
          now,
          now,
          ...values(s),
          id,
          ...values(s),
        )
        .first();
      if (!result)
        throw Error(
          'Five browsers are already enabled. Disable one before adding another.',
        );
      await db
        .prepare(
          'DELETE FROM push_deliveries WHERE subscription_id=? AND subscription_version NOT IN (SELECT version FROM push_subscriptions WHERE id=?)',
        )
        .bind(id, id)
        .run();
      return id;
    },
    async remove(s: AlertOwner, id: string) {
      await db.batch([
        db
          .prepare(
            'DELETE FROM push_deliveries WHERE subscription_id=? AND EXISTS(SELECT 1 FROM push_subscriptions WHERE id=? AND user_id=? AND wallet=?)',
          )
          .bind(id, id, ...values(s)),
        db
          .prepare(
            'DELETE FROM push_subscriptions WHERE id=? AND user_id=? AND wallet=?',
          )
          .bind(id, ...values(s)),
      ]);
    },
  };
}

export function pushConfig(env: Record<string, unknown>): VapidKeys | null {
  return typeof env.PUSH_VAPID_PUBLIC_KEY === 'string' &&
    typeof env.PUSH_VAPID_PRIVATE_KEY === 'string'
    ? {
        publicKey: env.PUSH_VAPID_PUBLIC_KEY,
        privateKey: env.PUSH_VAPID_PRIVATE_KEY,
        subject: 'https://tryfreestock.com',
      }
    : null;
}
export function pushMessage(id: string, createdAt: number) {
  return {
    title: 'Freestock alert',
    body: 'Your lending plan has an update. Open Freestock for a fresh purchase check.',
    id,
    createdAt,
    expiresAt: createdAt + 21600,
  };
}
export function pushResult(
  status: number,
  attempts: number,
  now: number,
  retryAfter: string | null = null,
) {
  if (status >= 200 && status < 300)
    return { status: 'accepted', next: now, remove: false };
  if (status === 404 || status === 410)
    return { status: 'expired', next: now, remove: true };
  const retry = status === 0 || status === 429 || status >= 500;
  const seconds = Number(retryAfter),
    retryDate = Date.parse(retryAfter ?? '');
  const requested =
    Number.isFinite(seconds) && seconds > 0
      ? seconds
      : Number.isFinite(retryDate)
        ? retryDate / 1000 - now
        : 0;
  return {
    status: retry && attempts < 4 ? 'pending' : 'failed',
    next:
      now +
      Math.min(3600, Math.max(900 * 2 ** Math.max(0, attempts - 1), requested)),
    remove: false,
  };
}
const eligible = `a.closed_at IS NULL AND a.revision=p.revision AND json_extract(p.settings,'$.purchaseAlerts')=1 AND json_extract(p.settings,'$.plan.paused')=0 AND json_extract(p.last_decision,'$.canReview')=1 AND COALESCE(json_extract(p.last_decision,'$.error'),0)=0 AND s.version=d.subscription_version AND s.user_id=a.user_id AND s.wallet=a.wallet`;
const joined = `push_deliveries d JOIN purchase_alerts a ON a.id=d.alert_id JOIN agent_plans p ON p.user_id=a.user_id AND p.wallet=a.wallet AND p.account=a.account JOIN push_subscriptions s ON s.id=d.subscription_id`;
export async function deliverPurchasePush(
  db: AgentDatabase,
  vapid: VapidKeys | null,
  send: typeof fetch = fetch,
  clock = () => Math.floor(Date.now() / 1000),
) {
  if (!vapid) return { accepted: 0, failed: 0, configured: false };
  const now = clock();
  await db
    .prepare(
      'DELETE FROM push_deliveries WHERE alert_id NOT IN (SELECT id FROM purchase_alerts WHERE created_at>?) OR subscription_id NOT IN (SELECT id FROM push_subscriptions)',
    )
    .bind(now - 21600)
    .run();
  const rows = await db
    .prepare(
      `SELECT d.alert_id AS alertId,d.subscription_id AS subscriptionId FROM ${joined} WHERE ${eligible} AND d.status='pending' AND d.next_attempt_at<=? AND d.lease_until<=? ORDER BY d.next_attempt_at LIMIT 6`,
    )
    .bind(now, now)
    .all<{ alertId: string; subscriptionId: string }>();
  let accepted = 0,
    failed = 0;
  for (const r of rows.results) {
    const token = crypto.randomUUID();
    const claim = await db
      .prepare(
        `UPDATE push_deliveries SET lease_token=?,lease_until=?,attempts=attempts+1 WHERE alert_id=? AND subscription_id=? AND status='pending' AND lease_until<=? AND next_attempt_at<=? RETURNING attempts`,
      )
      .bind(token, clock() + 60, r.alertId, r.subscriptionId, clock(), clock())
      .first<{ attempts: number }>();
    if (!claim) continue;
    // Recheck consent, plan and evidence after claiming, immediately before the external send.
    const job = await db
      .prepare(
        `SELECT s.subscription,s.version,a.created_at AS createdAt FROM ${joined} WHERE ${eligible} AND d.alert_id=? AND d.subscription_id=? AND d.lease_token=? AND a.created_at>?`,
      )
      .bind(r.alertId, r.subscriptionId, token, clock() - 21600)
      .first<{ subscription: string; version: string; createdAt: number }>();
    if (!job) {
      await db
        .prepare(
          "UPDATE push_deliveries SET status='cancelled',lease_until=0 WHERE alert_id=? AND subscription_id=? AND lease_token=?",
        )
        .bind(r.alertId, r.subscriptionId, token)
        .run();
      continue;
    }
    let status = 0,
      retryAfter: string | null = null;
    try {
      const subscription = validateSubscription(JSON.parse(job.subscription));
      const payload = await buildPushPayload(
        {
          data: pushMessage(r.alertId, job.createdAt),
          options: {
            ttl: 900,
            topic: r.alertId.replace(/-/g, ''),
            urgency: 'normal',
          },
        },
        subscription,
        vapid,
      );
      const stillCurrent = await db
        .prepare(
          `SELECT d.alert_id FROM ${joined} WHERE ${eligible} AND d.alert_id=? AND d.subscription_id=? AND d.lease_token=? AND s.version=? AND a.created_at>? AND d.lease_until>?`,
        )
        .bind(
          r.alertId,
          r.subscriptionId,
          token,
          job.version,
          clock() - 21600,
          clock(),
        )
        .first();
      if (!stillCurrent) {
        await db
          .prepare(
            "UPDATE push_deliveries SET status='cancelled',lease_until=0 WHERE alert_id=? AND subscription_id=? AND lease_token=?",
          )
          .bind(r.alertId, r.subscriptionId, token)
          .run();
        continue;
      }
      const response = await send(subscription.endpoint, {
        ...payload,
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
      status = response.status;
      retryAfter = response.headers.get('retry-after');
      await response.body?.cancel();
    } catch {
      /* Never log private endpoint/key or provider error text. Bounded retry below. */
    }
    const result = pushResult(status, claim.attempts, clock(), retryAfter);
    await db
      .prepare(
        'UPDATE push_deliveries SET status=?,next_attempt_at=?,lease_until=0,lease_token=NULL WHERE alert_id=? AND subscription_id=? AND lease_token=?',
      )
      .bind(result.status, result.next, r.alertId, r.subscriptionId, token)
      .run();
    if (result.remove)
      await db
        .prepare('DELETE FROM push_subscriptions WHERE id=? AND version=?')
        .bind(r.subscriptionId, job.version)
        .run();
    if (result.status === 'accepted') accepted++;
    else failed++;
  }
  return { accepted, failed, configured: true };
}
