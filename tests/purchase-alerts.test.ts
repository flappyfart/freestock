import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  createAgentStore,
  type AgentDatabase,
  type SavedDecision,
} from '../lib/live/agent-store.ts';
import { createPurchaseAlertStore } from '../lib/live/purchase-alert-store.ts';
import {
  createPushStore,
  deliverPurchasePush,
  pushMessage,
  pushResult,
  validateSubscription,
} from '../lib/live/purchase-push.ts';
import {
  defaultAgentSettings,
  validateAgentSettings,
} from '../lib/live/agent-settings.ts';
const wallet = `0x${'1'.repeat(40)}`,
  account = `0x${'2'.repeat(40)}`,
  deployment = `0x${'3'.repeat(64)}`;
const scope = { userId: `wallet:4663:${wallet}`, wallet, account };
function fixture() {
  const sql = new DatabaseSync(':memory:');
  for (const file of [
    '0004_moaning_triathlon.sql',
    '0005_slimy_smiling_tiger.sql',
  ])
    sql.exec(
      readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8'),
    );
  function statement(
    query: string,
    values: unknown[] = [],
  ): ReturnType<AgentDatabase['prepare']> {
    const args = () => values as (string | number | null)[];
    return {
      bind: (...v) => statement(query, v),
      first: async <T>() => (sql.prepare(query).get(...args()) as T) ?? null,
      all: async <T>() => ({
        results: sql.prepare(query).all(...args()) as T[],
      }),
      run: async () => sql.prepare(query).run(...args()),
    };
  }
  let queue = Promise.resolve<unknown>(null);
  const db: AgentDatabase = {
    prepare: statement,
    batch: (ss) => {
      const job = queue.then(async () => {
        sql.exec('BEGIN');
        try {
          for (const s of ss) await s.run();
          sql.exec('COMMIT');
        } catch (e) {
          sql.exec('ROLLBACK');
          throw e;
        }
      });
      queue = job.catch(() => null);
      return job;
    },
  };
  let now = 1800000000;
  const clock = () => now,
    store = createAgentStore(db, clock),
    alerts = createPurchaseAlertStore(db, clock),
    push = createPushStore(db, clock);
  return {
    sql,
    db,
    clock,
    store,
    alerts,
    push,
    advance: (n = 31) => (now += n),
    save: (overrides = {}) =>
      store.save(
        scope,
        deployment,
        {
          ...structuredClone(defaultAgentSettings),
          monitoring: true,
          purchaseAlerts: true,
          ...overrides,
        },
        0,
      ),
    async check(decision: SavedDecision = ready) {
      const p = (await store.get(scope))!,
        token = (await store.claim(p, p.revision, true))!;
      assert.ok(token);
      await store.finish(
        p,
        token,
        { ...decision, checkedAt: new Date(now * 1000).toISOString() },
        'background',
      );
      now += 31;
    },
  };
}
const ready: SavedDecision = {
  code: 'review',
  title: 'Review',
  reason: 'Rules met',
  canQuote: true,
  canReview: true,
  assets: '12000000',
  checkedAt: new Date(1800000000000).toISOString(),
};
const waiting: SavedDecision = {
  ...ready,
  code: 'accumulate',
  title: 'Waiting',
  canQuote: false,
  canReview: false,
};
async function keys() {
  const key = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const pub = Buffer.from(
    await crypto.subtle.exportKey('raw', key.publicKey),
  ).toString('base64url');
  const priv = await crypto.subtle.exportKey('jwk', key.privateKey);
  return {
    publicKey: pub,
    privateKey: priv.d!,
    subject: 'https://tryfreestock.com',
  };
}
async function subscription(suffix = 'test') {
  const k = await keys();
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${suffix}`,
    expirationTime: null,
    keys: {
      p256dh: k.publicKey,
      auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
        'base64url',
      ),
    },
  };
}

void test('old settings default alerts off and invalid opt-in is rejected', () => {
  const { purchaseAlerts: _, ...legacy } = defaultAgentSettings;
  assert.equal(validateAgentSettings(legacy).purchaseAlerts, false);
  assert.throws(() =>
    validateAgentSettings({ ...legacy, purchaseAlerts: 'yes' }),
  );
});
void test('one alert per ready episode, durable read state, no error recovery spam', async () => {
  const f = fixture();
  await f.save();
  await f.check(waiting);
  assert.equal((await f.alerts.list(scope)).length, 0);
  await f.check();
  const first = (await f.alerts.list(scope))[0];
  assert.ok(first.current);
  await f.alerts.read(scope, first.id);
  await f.check();
  await f.check({ ...waiting, code: 'stale', error: true });
  assert.equal((await f.alerts.list(scope))[0].checkUnavailable, true);
  await f.check();
  let rows = await createPurchaseAlertStore(f.db, f.clock).list(scope);
  assert.equal(rows.length, 1);
  assert.ok(rows[0].readAt);
  assert.ok(rows[0].confirmedAt > first.confirmedAt);
  await f.check({ ...waiting, code: 'stale' });
  await f.check({ ...waiting, code: 'quote' });
  await f.check();
  assert.equal((await f.alerts.list(scope)).length, 1);
  await f.check(waiting);
  assert.equal((await f.alerts.list(scope))[0].current, false);
  await f.check();
  rows = await f.alerts.list(scope);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].readAt, null);
});
void test('alerts require opt-in and a genuine review decision', async () => {
  const f = fixture();
  await f.save({ purchaseAlerts: false });
  await f.check();
  assert.equal((await f.alerts.list(scope)).length, 0);
  const p = (await f.store.get(scope))!;
  await f.store.save(
    scope,
    deployment,
    { ...p.settings, purchaseAlerts: true },
    1,
  );
  for (const d of [
    { ...ready, error: true },
    { ...ready, code: 'stale' as const },
    { ...ready, canReview: false },
    { ...ready, assets: '0' },
  ])
    await f.check(d);
  assert.equal((await f.alerts.list(scope)).length, 0);
});
void test('wallet isolation and pause/edit/remove invalidate old leases and alerts', async () => {
  const f = fixture();
  await f.save();
  await f.check();
  const row = (await f.alerts.list(scope))[0];
  const stranger = { ...scope, userId: 'other', wallet: `0x${'9'.repeat(40)}` };
  assert.equal((await f.alerts.list(stranger)).length, 0);
  await f.alerts.read(stranger, row.id);
  assert.equal((await f.alerts.list(scope))[0].readAt, null);
  const p = (await f.store.get(scope))!,
    token = (await f.store.claim(p, p.revision, true))!;
  await f.store.save(
    scope,
    deployment,
    { ...p.settings, plan: { ...p.settings.plan, paused: true } },
    p.revision,
  );
  assert.equal(await f.store.finish(p, token, ready, 'background'), false);
  assert.equal((await f.alerts.list(scope))[0].current, false);
  await assert.rejects(f.store.remove(scope, p.revision));
  assert.equal((await f.alerts.list(scope)).length, 1);
  await f.store.remove(scope, p.revision + 1);
  assert.equal((await f.alerts.list(scope)).length, 0);
});
void test('expired workers cannot notify and a replacement check can', async () => {
  const f = fixture();
  const p = (await f.save())!,
    old = (await f.store.claim(p, 1))!;
  f.advance(181);
  const fresh = (await f.store.claim(p, 1))!;
  assert.equal(await f.store.finish(p, old, ready, 'background'), false);
  assert.equal((await f.alerts.list(scope)).length, 0);
  assert.equal(await f.store.finish(p, fresh, ready, 'background'), true);
  assert.equal((await f.alerts.list(scope)).length, 1);
});
void test('subscription URLs and malformed keys cannot become arbitrary outbound requests', async () => {
  const valid = await subscription();
  for (const endpoint of [
    'http://fcm.googleapis.com/x',
    'https://127.0.0.1/a',
    'https://localhost/a',
    'https://fcm.googleapis.com.evil.test/a',
    'https://u:p@fcm.googleapis.com/a',
    'https://fcm.googleapis.com:8443/a',
    'https://fcm.googleapis.com/a#x',
    'https://push.apple.com.evil.test/a',
  ])
    assert.throws(() => validateSubscription({ ...valid, endpoint }));
  assert.throws(() =>
    validateSubscription({ ...valid, keys: { ...valid.keys, auth: 'broken' } }),
  );
  const f = fixture();
  await assert.rejects(
    f.push.register(scope, {
      ...valid,
      keys: {
        ...valid.keys,
        p256dh: Buffer.alloc(65, 4).toString('base64url'),
      },
    }),
  );
});
void test('explicit browser opt-in queues only future alerts and rebinding cancels old wallet deliveries', async () => {
  const f = fixture();
  await f.save();
  await f.check();
  const sub = await subscription(),
    id = await f.push.register(scope, sub);
  assert.equal(
    f.sql.prepare('SELECT count(*) n FROM push_deliveries').get()?.n,
    0,
  );
  await f.check(waiting);
  await f.check();
  assert.equal(
    f.sql.prepare('SELECT count(*) n FROM push_deliveries').get()?.n,
    1,
  );
  const other = { ...scope, userId: 'other', wallet: `0x${'9'.repeat(40)}` };
  await f.push.remove(other, id);
  assert.equal(await f.push.subscribed(scope, id), true);
  await f.push.register(other, sub);
  assert.equal(await f.push.subscribed(scope, id), false);
  assert.equal(
    f.sql.prepare('SELECT count(*) n FROM push_deliveries').get()?.n,
    0,
  );
});
void test('Web Push is encrypted, bounded, consent-checked, deduplicated and accepted only once', async () => {
  const f = fixture();
  await f.save();
  await f.push.register(scope, await subscription());
  await f.check();
  const vapid = await keys();
  let sent = 0;
  const send: typeof fetch = async (_url, init) => {
    sent++;
    assert.equal(init?.redirect, 'error');
    assert.ok(init?.signal);
    const h = new Headers(init?.headers);
    assert.equal(h.get('content-encoding'), 'aes128gcm');
    assert.match(h.get('authorization')!, /^vapid /);
    assert.equal(h.get('ttl'), '900');
    assert.equal(
      Buffer.from(init!.body as Uint8Array).includes(Buffer.from('Freestock')),
      false,
    );
    return new Response(null, { status: 201 });
  };
  const results = await Promise.all([
    deliverPurchasePush(f.db, vapid, send, f.clock),
    deliverPurchasePush(f.db, vapid, send, f.clock),
  ]);
  assert.equal(sent, 1);
  assert.equal(
    results.reduce((n, r) => n + r.accepted, 0),
    1,
  );
  await f.check();
  await deliverPurchasePush(f.db, vapid, send, f.clock);
  assert.equal(sent, 1);
  await f.check(waiting);
  await f.check();
  const p = (await f.store.get(scope))!;
  await f.store.save(
    scope,
    deployment,
    { ...p.settings, plan: { ...p.settings.plan, paused: true } },
    p.revision,
  );
  await deliverPurchasePush(f.db, vapid, send, f.clock);
  assert.equal(sent, 1);
});
void test('unsubscribe, changed revision and expired queue cannot send; gone endpoints are removed', async () => {
  for (const change of ['unsubscribe', 'edit', 'expiry', 'gone']) {
    const f = fixture();
    await f.save();
    const id = await f.push.register(scope, await subscription());
    await f.check();
    if (change === 'unsubscribe') await f.push.remove(scope, id);
    if (change === 'edit') {
      const p = (await f.store.get(scope))!;
      await f.store.save(
        scope,
        deployment,
        { ...p.settings, maximumPurchase: '30000000' },
        p.revision,
      );
    }
    if (change === 'expiry') f.advance(21601);
    let sent = 0;
    await deliverPurchasePush(
      f.db,
      await keys(),
      async () => {
        sent++;
        return new Response(null, { status: 410 });
      },
      f.clock,
    );
    assert.equal(sent, change === 'gone' ? 1 : 0);
    if (change === 'gone')
      assert.equal(await f.push.subscribed(scope, id), false);
  }
});
void test('retry classification is finite and private push data contains no balance or address', () => {
  assert.equal(pushResult(401, 1, 10).status, 'failed');
  assert.equal(pushResult(503, 4, 10).status, 'failed');
  assert.equal(pushResult(0, 1, 10).status, 'pending');
  assert.equal(pushResult(429, 1, 10, '999999').next, 3610);
  const message = JSON.stringify(pushMessage('opaque', 1800000000));
  assert.ok(!message.includes(wallet));
  assert.ok(!message.includes('12000000'));
  assert.ok(!message.includes('NVDA'));
});
void test('service worker uses generic content, stable notification tags, and fixed same-origin navigation', async () => {
  const handlers: Record<string, (e: unknown) => void> = {},
    shown: { title: string; options: Record<string, unknown> }[] = [],
    opened: string[] = [];
  let pending: Promise<unknown> = Promise.resolve();
  const self = {
    addEventListener: (name: string, fn: (e: unknown) => void) =>
      (handlers[name] = fn),
    registration: {
      showNotification: async (
        title: string,
        options: Record<string, unknown>,
      ) => shown.push({ title, options }),
    },
    location: { origin: 'https://tryfreestock.com' },
    clients: { openWindow: async (url: string) => opened.push(url) },
  };
  runInNewContext(
    readFileSync(
      new URL('../public/freestock-push.js', import.meta.url),
      'utf8',
    ),
    { self, URL, Date },
  );
  const event = {
    data: {
      json: () => ({
        ...pushMessage('11111111-1111-1111-1111-111111111111', 1800000000),
        title: 'private balance',
        url: 'https://evil.test',
      }),
    },
    waitUntil: (p: Promise<unknown>) => (pending = p),
  };
  handlers.push(event);
  await pending;
  handlers.push(event);
  await pending;
  assert.equal(shown[0].title, 'Freestock alert');
  assert.equal(shown[0].options.tag, shown[1].options.tag);
  assert.equal(shown[0].options.renotify, false);
  handlers.notificationclick({
    notification: { close: () => null },
    waitUntil: event.waitUntil,
  });
  await pending;
  assert.deepEqual(opened, [
    'https://tryfreestock.com/dashboard?view=agentic&alerts=1',
  ]);
});
