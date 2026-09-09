import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  createAgentStore,
  type AgentDatabase,
  type SavedDecision,
} from '../lib/live/agent-store.ts';
import {
  defaultAgentSettings,
  validateAgentSettings,
  estimateCosts,
  purchaseBudget,
} from '../lib/live/agent-settings.ts';
import {
  runMonitor,
  monitorHealth,
  validMonitorToken,
} from '../lib/live/agent-monitor.ts';
import { enforceAgentPolicy } from '../lib/live/agent-policy.ts';
import type { Prepared } from '../lib/live/wallet-transaction.ts';
const wallet = `0x${'1'.repeat(40)}`,
  account = `0x${'2'.repeat(40)}`,
  deployment = `0x${'3'.repeat(64)}`,
  scope = { userId: `wallet:4663:${wallet}`, wallet, account };
function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(
    readFileSync(
      new URL('../drizzle/0004_moaning_triathlon.sql', import.meta.url),
      'utf8',
    ),
  );
  sql.exec(
    readFileSync(
      new URL('../drizzle/0005_slimy_smiling_tiger.sql', import.meta.url),
      'utf8',
    ),
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
          const rows = [];
          for (const s of ss) rows.push(await s.run());
          sql.exec('COMMIT');
          return rows;
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
    store = createAgentStore(db, clock);
  return {
    sql,
    db,
    clock,
    store,
    advance: (seconds: number) => (now += seconds),
    save: (overrides = {}) =>
      store.save(
        scope,
        deployment,
        {
          ...structuredClone(defaultAgentSettings),
          monitoring: true,
          ...overrides,
        },
        0,
      ),
  };
}
const waiting: SavedDecision = {
  code: 'accumulate',
  title: 'Waiting',
  reason: 'Below minimum',
  canQuote: false,
  canReview: false,
  checkedAt: new Date(1800000000000).toISOString(),
};
void test('plans survive a store reload, isolate wallets, and reject stale updates', async () => {
  const f = fixture();
  const saved = (await f.save())!;
  assert.equal(saved.revision, 1);
  assert.deepEqual(
    (await createAgentStore(f.db).get(scope))?.settings,
    saved.settings,
  );
  assert.equal(
    await f.store.get({ ...scope, userId: 'another-profile' }),
    null,
  );
  await assert.rejects(f.save(), /changed/);
  const changed = await f.store.save(
    scope,
    deployment,
    { ...saved.settings, maximumPurchase: '30000000' },
    1,
  );
  assert.equal(changed?.revision, 2);
  await assert.rejects(
    f.store.save(scope, deployment, saved.settings, 1),
    /changed/,
  );
  await assert.rejects(f.store.remove(scope, 1), /changed/);
  assert.equal((await f.store.get(scope))?.revision, 2);
});
void test('only one concurrent monitor can claim a plan and manual checks are rate limited', async () => {
  const f = fixture(),
    p = (await f.save())!;
  const claims = await Promise.all([f.store.claim(p, 1), f.store.claim(p, 1)]);
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(
    await f.store.finish(p, claims.find(Boolean)!, waiting, 'background'),
    true,
  );
  assert.equal(await f.store.claim(p, 1, true), null);
  f.advance(31);
  assert.ok(await f.store.claim(p, 1, true));
});
void test('pausing or deleting a plan invalidates an in-flight result and stops background work', async () => {
  const f = fixture(),
    p = (await f.save())!,
    token = (await f.store.claim(p, 1))!;
  const paused = (await f.store.save(
    scope,
    deployment,
    { ...p.settings, plan: { ...p.settings.plan, paused: true } },
    1,
  ))!;
  assert.equal(await f.store.finish(p, token, waiting, 'background'), false);
  assert.equal((await f.store.due()).length, 0);
  assert.equal((await f.store.history(scope)).length, 0);
  const manual = (await f.store.claim(paused, 2, true))!;
  await f.store.remove(scope, 2);
  assert.equal(await f.store.finish(paused, manual, waiting, 'manual'), false);
  assert.equal(await f.store.get(scope), null);
});
void test('lease expiry recovers crashed work and an older worker cannot overwrite its replacement', async () => {
  const f = fixture(),
    p = (await f.save())!,
    old = (await f.store.claim(p, 1))!;
  f.advance(181);
  const newer = (await f.store.claim(p, 1))!;
  assert.notEqual(old, newer);
  assert.equal(await f.store.finish(p, old, waiting, 'background'), false);
  assert.equal(await f.store.finish(p, newer, waiting, 'background'), true);
});
void test('failed checks back off and history retains only bounded records', async () => {
  const f = fixture();
  await f.save();
  for (let i = 0; i < 105; i++) {
    const p = (await f.store.get(scope))!,
      token = (await f.store.claim(p, p.revision, true))!;
    assert.ok(token);
    await f.store.finish(p, token, { ...waiting, error: i === 104 }, 'manual');
    f.advance(31);
  }
  assert.equal((await f.store.history(scope)).length, 50);
  assert.equal(
    f.sql.prepare('SELECT count(*) AS n FROM agent_decisions').get()?.n,
    100,
  );
  const p = (await f.store.get(scope))!;
  assert.equal(p.failureCount, 1);
  assert.equal(p.nextCheckAt - p.lastCheckedAt!, 120);
});
void test('monitor heartbeat prevents overlapping batches and exposes no profile data', async () => {
  const f = fixture();
  await f.save();
  let entered!: () => void, finish!: () => void;
  const started = new Promise<void>((r) => (entered = r)),
    wait = new Promise<void>((r) => (finish = r));
  const run = runMonitor(
    f.db,
    async (p) => {
      entered();
      await wait;
      const token = (await f.store.claim(p, p.revision))!;
      await f.store.finish(p, token, waiting, 'background');
      return { applied: true, busy: false };
    },
    f.clock,
  );
  await started;
  assert.equal(
    (
      await runMonitor(
        f.db,
        async () => {
          throw Error('must not run');
        },
        f.clock,
      )
    ).busy,
    true,
  );
  finish();
  assert.equal((await run).checked, 1);
  assert.deepEqual(await monitorHealth(f.db, f.clock()), {
    status: 'healthy',
    lastCompletedAt: f.clock(),
  });
  f.advance(2701);
  assert.equal((await monitorHealth(f.db, f.clock())).status, 'delayed');
});
void test('monitor authentication rejects missing, wrong, and oversized tokens', async () => {
  const key = 'x'.repeat(64);
  assert.equal(await validMonitorToken(`Bearer ${key}`, key), true);
  for (const value of [null, '', key, 'Bearer wrong', 'x'.repeat(300)])
    assert.equal(await validMonitorToken(value, key), false);
  assert.equal(await validMonitorToken(`Bearer ${key}`, null), false);
});
void test('costs use USDG price instead of assuming the peg, round up, and preserve source timestamps', () => {
  const input = {
    gasWei: 100000000000000n,
    assets: 10000000n,
    poolFees: 5000n,
    ethPrice: 250000000000n,
    usdgPrice: 100000000n,
    ethDecimals: 8,
    usdgDecimals: 8,
    now: 1800000000000,
    ethUpdatedAt: 1799999990,
    usdgUpdatedAt: 1799999980,
  };
  const normal = estimateCosts(input);
  assert.equal(normal.gasUsdg, '250000');
  assert.equal(normal.totalFeesUsdg, '255000');
  assert.equal(normal.feeBps, 255);
  assert.equal(
    estimateCosts({ ...input, usdgPrice: 50000000n }).gasUsdg,
    '500000',
  );
  assert.equal(
    estimateCosts({ ...input, ethPrice: 2500000000n, ethDecimals: 6 }).gasUsdg,
    '250000',
  );
  assert.equal(estimateCosts({ ...input, gasWei: 1n }).gasUsdg, '1');
  assert.equal(
    Date.parse(normal.expiresAt) - Date.parse(normal.observedAt),
    45000,
  );
  assert.equal(Date.parse(normal.ethUpdatedAt), 1799999990000);
  assert.throws(() => estimateCosts({ ...input, usdgPrice: 0n }));
});
void test('purchase limits bound recommendations and invalid plans are rejected', () => {
  assert.equal(purchaseBudget(defaultAgentSettings, '99000000'), 25000000n);
  assert.equal(purchaseBudget(defaultAgentSettings, '1000000'), 1000000n);
  for (const invalid of [
    { maximumPurchase: '0' },
    { maximumPurchase: '1' },
    { maximumCostBps: 0 },
    { maximumCostBps: 500.5 },
    { intervalMinutes: 1 },
    { monitoring: 'yes' },
  ])
    assert.throws(() =>
      validateAgentSettings({ ...defaultAgentSettings, ...invalid }),
    );
});
void test('fresh purchase reviews enforce saved revisions, pauses, allocation, budgets and fee limits', async () => {
  const f = fixture(),
    saved = (await f.save())!,
    now = f.clock() * 1000;
  const p = {
    owner: wallet,
    account,
    deployment,
    action: 'harvest',
    assets: '2000000',
    estimatedGasCostWei: '1',
    expiresAt: new Date(now + 45000).toISOString(),
    purchases: [{ symbol: 'NVDA', weightBps: 10000, amountIn: '2000000' }],
  } as Prepared;
  assert.doesNotThrow(() => enforceAgentPolicy(saved, 1, p, undefined, now));
  assert.throws(() => enforceAgentPolicy(saved, 2, p, undefined, now));
  assert.throws(() =>
    enforceAgentPolicy(
      {
        ...saved,
        settings: {
          ...saved.settings,
          plan: { ...saved.settings.plan, paused: true },
        },
      },
      1,
      p,
      undefined,
      now,
    ),
  );
  for (const delta of [
    { assets: '26000000' },
    { assets: '10' },
    { estimatedGasCostWei: '1000000000000000000' },
    { owner: account },
    { expiresAt: new Date(now).toISOString() },
    { purchases: [{ symbol: 'AAPL', weightBps: 10000, amountIn: '2000000' }] },
  ])
    assert.throws(() =>
      enforceAgentPolicy(
        saved,
        1,
        { ...p, ...delta } as Prepared,
        undefined,
        now,
      ),
    );
  assert.throws(() =>
    enforceAgentPolicy(
      saved,
      1,
      p,
      { feeBps: 501, expiresAt: p.expiresAt } as never,
      now,
    ),
  );
});
