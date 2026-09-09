import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import {
  createHistoryStore,
  type HistoryDatabase,
} from '../lib/live/history-store.ts';
import { createHistoryReader } from '../lib/live/history-reader.ts';
import {
  decodeHistoryEvents,
  historyAbi,
  historyTotals,
  type HistoryRecord,
} from '../lib/live/history-model.ts';
import { cloudRestoreCandidate } from '../lib/live/account-reference.ts';
import { accountPlan } from '../lib/live/account-plan.ts';
import { ENABLED_STOCKS } from '../lib/live/basket.ts';

const wallet = `0x${'1'.repeat(40)}`,
  account = `0x${'2'.repeat(40)}`;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;
const hex = (n: number) => `0x${n.toString(16)}`;
const deployment = hash(1),
  user = 'alice',
  scope = { user, wallet, account };
function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(
    readFileSync(
      new URL('../drizzle/0002_polite_mystique.sql', import.meta.url),
      'utf8',
    ),
  );
  function statement(
    query: string,
    values: unknown[] = [],
  ): ReturnType<HistoryDatabase['prepare']> {
    const bindValues = () =>
      values as (string | number | bigint | null | Uint8Array)[];
    return {
      bind: (...v) => statement(query, v),
      first: async <T>() =>
        (sql.prepare(query).get(...bindValues()) as T) ?? null,
      all: async <T>() => ({
        results: sql.prepare(query).all(...bindValues()) as T[],
      }),
      run: async () => sql.prepare(query).run(...bindValues()),
    };
  }
  const db: HistoryDatabase = {
    prepare: statement,
    batch: async (statements) => {
      sql.exec('BEGIN');
      try {
        for (const s of statements) await s.run();
        sql.exec('COMMIT');
      } catch (e) {
        sql.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return { sql, store: createHistoryStore(db) };
}
function fixture() {
  const { sql, store } = database();
  let head = 20,
    branch = 0;
  const transactions = new Map<string, Record<string, unknown>>(),
    receipts = new Map<string, Record<string, unknown>>();
  let onLogs: (() => void) | null = null;
  const blockHash = (n: number) =>
    hash(100000 + n + (n > 10 ? branch * 10000 : 0));
  function add(
    id: number,
    block: number | null,
    action = 'deposit',
    events: [string, unknown[]][] = [
      ['Deposited', [10_000_000n, 9_000_000n, 10_000_000n]],
    ],
    nonce = id,
  ) {
    const h = hash(id);
    const tx = {
      hash: h,
      from: wallet,
      to: action === 'deploy' ? null : account,
      chainId: '0x1237',
      value: '0x0',
      nonce: hex(nonce),
      blockNumber: block === null ? null : hex(block),
      blockHash: block === null ? null : blockHash(block),
      input:
        action === 'deploy'
          ? accountPlan(wallet).transaction.data
          : historyAbi.encodeFunctionData(
              action,
              action === 'deposit'
                ? [10_000_000n, 1n]
                : action === 'withdraw'
                  ? [1n, 10n]
                  : action === 'withdrawAll'
                    ? [0n]
                    : action === 'compound'
                      ? [1n]
                      : [[], [], [], [], 0n, 2000000000n],
            ),
    };
    transactions.set(h, tx);
    if (block !== null)
      receipts.set(h, {
        transactionHash: h,
        from: wallet,
        blockNumber: hex(block),
        blockHash: blockHash(block),
        transactionIndex: '0x0',
        status: '0x1',
        gasUsed: '0x100',
        effectiveGasPrice: '0x2',
        logs: events.map(([name, args], i) => {
          const encoded = historyAbi.encodeEventLog(
            historyAbi.getEvent(name)!,
            args,
          );
          return {
            address: account,
            transactionHash: h,
            blockNumber: hex(block),
            blockHash: blockHash(block),
            logIndex: hex(i),
            transactionIndex: '0x0',
            removed: false,
            ...encoded,
          };
        }),
      });
    return h;
  }
  add(1, 10, 'deploy', []);
  const calls: { method: string; params: unknown[] }[] = [];
  const rpc = async (method: string, params: unknown[]) => {
    calls.push({ method, params });
    if (method === 'eth_getBlockByNumber') {
      const n = Number(BigInt(String(params[0])));
      return {
        number: hex(n),
        hash: blockHash(n),
        timestamp: hex(1788940800 + n),
      };
    }
    if (method === 'eth_getTransactionByHash')
      return transactions.get(String(params[0])) ?? null;
    if (method === 'eth_getTransactionReceipt')
      return receipts.get(String(params[0])) ?? null;
    if (method === 'eth_getLogs') {
      const q = params[0] as { fromBlock: string; toBlock: string };
      const logs = Array.from(receipts.values())
        .flatMap((r) => r.logs as Record<string, unknown>[])
        .filter(
          (l) =>
            Number(BigInt(String(l.blockNumber))) >=
              Number(BigInt(q.fromBlock)) &&
            Number(BigInt(String(l.blockNumber))) <= Number(BigInt(q.toBlock)),
        );
      onLogs?.();
      return logs;
    }
    throw Error(`Unexpected ${method}`);
  };
  const verified = () => ({
    owner: wallet,
    account,
    deployment,
    deploymentBlock: 10,
    deploymentBlockHash: blockHash(10),
  });
  const reader = createHistoryReader(
    { rpc, pin: async () => hex(head), verify: async () => verified() },
    store,
  );
  return {
    sql,
    store,
    reader,
    add,
    transactions,
    receipts,
    calls,
    blockHash,
    verified,
    setHead: (n: number) => {
      head = n;
    },
    reorg: () => {
      branch++;
    },
    onLogs: (fn: () => void) => {
      onLogs = fn;
    },
  };
}
void test('profile scope, wallet normalization, duplicate registration and separate accounts', async () => {
  const f = fixture();
  await f.reader.register(user, wallet, deployment);
  await f.reader.register(
    user,
    wallet.toUpperCase().replace('0X', '0x'),
    deployment,
  );
  assert.equal((await f.store.list(user, wallet)).length, 1);
  assert.deepEqual(await f.store.list('bob', wallet), []);
  assert.deepEqual(
    (await f.store.page({ user: 'bob', wallet, account })).records,
    [],
  );
  await f.store.remember(user, {
    ...f.verified(),
    account: `0x${'3'.repeat(40)}`,
    deployment: hash(2),
  });
  assert.equal((await f.store.list(user, wallet)).length, 2);
  f.sql.close();
});
void test('repeat scans retain all basket legs and partial withdrawals without duplicate totals', async () => {
  const f = fixture();
  f.add(2, 11);
  f.add(3, 12, 'harvest', [
    ['Compounded', [20n, 10000020n]],
    ...ENABLED_STOCKS.map(
      (s) => ['StockPurchased', [s.address, 10n, 100n]] as [string, unknown[]],
    ),
  ]);
  f.add(4, 13, 'withdraw', [['Withdrawn', [1000n, 9999020n]]]);
  await f.reader.sync(user, wallet, deployment);
  const first = await f.store.page(scope),
    totals = historyTotals(first.records);
  assert.equal(first.records.length, 4);
  assert.equal(totals.converted, '50');
  assert.equal(totals.stocks.length, 5);
  assert.equal(totals.withdrawn, '1000');
  assert.equal(first.records.find((r) => r.hash === hash(3))?.events.length, 6);
  assert.equal(
    first.records.find((r) => r.hash === hash(2))?.events[0].shares,
    '9000000',
  );
  await f.reader.sync(user, wallet, deployment);
  assert.deepEqual(historyTotals((await f.store.page(scope)).records), totals);
  assert.deepEqual(historyTotals([...first.records, ...first.records]), totals);
  f.sql.close();
});
void test('stale concurrent writes cannot overwrite newer history or regress checkpoints', async () => {
  const f = fixture(),
    a = await f.reader.register(user, wallet, deployment);
  const r = await f.reader.transaction(a, deployment);
  await f.store.commit(scope, a, [r], {
    block: 20,
    hash: f.blockHash(20),
    head: 20,
    reset: false,
    from: 10,
  });
  await assert.rejects(() =>
    f.store.commit(scope, a, [{ ...r, status: 'pending', events: [] }], {
      block: 15,
      hash: f.blockHash(15),
      head: 20,
      reset: false,
      from: 10,
    }),
  );
  const saved = await f.store.page(scope);
  assert.equal(saved.account?.syncedBlock, 20);
  assert.equal(saved.records[0].status, 'confirmed');
  f.sql.close();
});
void test('empty old-branch log reads cannot advance through a new-branch boundary', async () => {
  const f = fixture();
  f.onLogs(() => f.reorg());
  await assert.rejects(() => f.reader.sync(user, wallet, deployment));
  assert.equal((await f.store.getAccount(scope))?.syncedBlock, null);
  assert.equal((await f.store.page(scope)).records.length, 0);
  f.sql.close();
});
void test('reorg invalidates prior totals and a re-mined hash contributes exactly once', async () => {
  const f = fixture();
  f.add(2, 11, 'harvest', [
    ['StockPurchased', [ENABLED_STOCKS[0].address, 100n, 500n]],
  ]);
  await f.reader.sync(user, wallet, deployment);
  assert.equal(
    historyTotals((await f.store.page(scope)).records).converted,
    '100',
  );
  f.reorg();
  f.transactions.delete(hash(2));
  f.receipts.delete(hash(2));
  await f.reader.sync(user, wallet, deployment);
  assert.equal(
    historyTotals((await f.store.page(scope)).records).converted,
    '0',
  );
  f.setHead(22);
  f.add(2, 21, 'harvest', [
    ['StockPurchased', [ENABLED_STOCKS[0].address, 80n, 400n]],
  ]);
  await f.reader.sync(user, wallet, deployment);
  const p = await f.store.page(scope);
  assert.equal(historyTotals(p.records).converted, '80');
  assert.equal(p.records.filter((r) => r.hash === hash(2)).length, 1);
  f.sql.close();
});
void test('pending, revert and linked same-nonce replacement preserve actual outcomes', async () => {
  const f = fixture();
  f.add(2, null, 'deposit', [], 7);
  await f.reader.track(user, wallet, deployment, hash(2));
  assert.equal((await f.store.transaction(scope, hash(2)))?.status, 'pending');
  f.add(3, 19, 'deposit', [['Deposited', [10n, 9n, 10n]]], 7);
  await f.reader.track(user, wallet, deployment, hash(3), hash(2));
  assert.equal((await f.store.transaction(scope, hash(2)))?.status, 'replaced');
  // The winner may be outside the next scan window but its relationship must survive.
  await f.reader.sync(user, wallet, deployment);
  f.setHead(30);
  await f.reader.sync(user, wallet, deployment);
  assert.equal((await f.store.transaction(scope, hash(2)))?.status, 'replaced');
  f.add(4, 29, 'deposit', [], 8);
  f.receipts.get(hash(4))!.status = '0x0';
  await f.reader.track(user, wallet, deployment, hash(4));
  assert.equal((await f.store.transaction(scope, hash(4)))?.status, 'reverted');
  await assert.rejects(() =>
    f.reader.track(user, wallet, deployment, hash(4), hash(2)),
  );
  f.sql.close();
});
void test('malformed emitter, wallet, chain and canonical block cannot enter history', async () => {
  for (const alter of [
    (f: ReturnType<typeof fixture>) => {
      f.transactions.get(hash(2))!.from = account;
    },
    (f: ReturnType<typeof fixture>) => {
      f.transactions.get(hash(2))!.chainId = '0x1';
    },
    (f: ReturnType<typeof fixture>) => {
      f.receipts.get(hash(2))!.blockHash = hash(999);
    },
    (f: ReturnType<typeof fixture>) => {
      (f.receipts.get(hash(2))!.logs as Record<string, unknown>[])[0].address =
        wallet;
    },
  ]) {
    const f = fixture();
    f.add(2, 11);
    alter(f);
    await assert.rejects(() =>
      f.reader.track(user, wallet, deployment, hash(2)),
    );
    assert.equal((await f.store.page(scope)).records.length, 0);
    f.sql.close();
  }
});
void test('invalid and duplicate event identities fail before accounting', () => {
  const f = fixture();
  f.add(2, 11);
  const logs = f.receipts.get(hash(2))!.logs as Record<string, unknown>[];
  const s = {
    wallet,
    account,
    hash: hash(2),
    block: 11,
    blockHash: f.blockHash(11),
  };
  assert.throws(() => decodeHistoryEvents([...logs, ...logs], s));
  assert.throws(() => decodeHistoryEvents([{ ...logs[0], removed: true }], s));
  f.sql.close();
});
void test('partial import advances bounded ranges and large reorg histories remain resumable', async () => {
  const f = fixture();
  f.setHead(20000);
  await f.reader.sync(user, wallet, deployment);
  assert.equal((await f.store.getAccount(scope))?.syncedBlock, 5009);
  const a = (await f.store.getAccount(scope))!;
  const base = await f.reader.transaction(a, deployment);
  const records: HistoryRecord[] = Array.from({ length: 120 }, (_, i) => ({
    ...base,
    hash: hash(1000 + i),
    nonce: String(1000 + i),
    block: 10000 + i,
    status: 'rechecking',
  }));
  await f.store.commit(scope, a, records);
  f.reorg();
  await f.reader.sync(user, wallet, deployment);
  assert.equal((await f.store.getAccount(scope))?.syncedBlock, 5009);
  f.sql.close();
});
void test('dense old history cannot pull a forward checkpoint backwards', async () => {
  const f = fixture();
  f.setHead(100);
  await f.reader.sync(user, wallet, deployment);
  for (let i = 0; i < 35; i++) f.add(100 + i, 99);
  f.setHead(101);
  await f.reader.sync(user, wallet, deployment);
  assert.equal((await f.store.getAccount(scope))?.syncedBlock, 101);
  f.sql.close();
});
void test('re-mined verified deployment resets old observations before importing again', async () => {
  const f = fixture();
  await f.reader.sync(user, wallet, deployment);
  const changed = await f.store.remember(user, {
    ...f.verified(),
    deploymentBlock: 12,
    deploymentBlockHash: hash(777),
  });
  assert.equal(changed.syncedBlock, null);
  assert.equal(changed.deploymentBlock, 12);
  assert.equal((await f.store.page(scope)).records[0].status, 'rechecking');
  f.sql.close();
});
void test('cloud restoration stays below URL, local journal, manual action and ambiguity', () => {
  const refs = [{ wallet, chainId: 4663, deployment }];
  assert.equal(cloudRestoreCandidate(wallet, refs, false)?.source, 'cloud');
  assert.equal(cloudRestoreCandidate(wallet, refs, true), null);
  assert.equal(
    cloudRestoreCandidate(
      wallet,
      [...refs, { ...refs[0], deployment: hash(2) }],
      false,
    ),
    null,
  );
  assert.equal(cloudRestoreCandidate(account, refs, false), null);
});
void test('a confirmed third replacement resolves every earlier request with the same nonce', async () => {
  const f = fixture();
  f.add(2, null, 'deposit', [], 7);
  f.add(3, null, 'deposit', [], 7);
  await f.reader.track(user, wallet, deployment, hash(2));
  await f.reader.track(user, wallet, deployment, hash(3), hash(2));
  f.add(4, 19, 'deposit', [['Deposited', [10n, 9n, 10n]]], 7);
  await f.reader.track(user, wallet, deployment, hash(4), hash(3));
  await f.reader.sync(user, wallet, deployment);
  for (const n of [2, 3]) {
    const record = await f.store.transaction(scope, hash(n));
    assert.equal(record?.status, 'replaced');
    assert.equal(record?.replacedBy, hash(4));
  }
  assert.equal(
    historyTotals((await f.store.page(scope)).records).deposited,
    '10',
  );
  f.sql.close();
});
