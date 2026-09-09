import type { HistoryRecord, SavedLiveAccount } from './history-model.ts';
import { historyAddress, historyHash } from './history-model.ts';
const CHAIN = 4663;
type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};
export type HistoryDatabase = {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
};
type Scope = { user: string; wallet: string; account: string };
const scopeValues = (s: Scope) => [
  s.user,
  CHAIN,
  historyAddress(s.wallet),
  historyAddress(s.account),
];
const where = 'user_id=? AND chain_id=? AND wallet=? AND account=?';
const columns = `wallet,account,chain_id AS chainId,deployment,deployment_block AS deploymentBlock,deployment_block_hash AS deploymentBlockHash,synced_block AS syncedBlock,synced_block_hash AS syncedBlockHash,head_block AS headBlock,version,updated_at AS updatedAt`;
export function createHistoryStore(database: HistoryDatabase) {
  const getAccount = (s: Scope) =>
    database
      .prepare(`SELECT ${columns} FROM live_accounts WHERE ${where}`)
      .bind(...scopeValues(s))
      .first<SavedLiveAccount>();
  const list = async (user: string, wallet: string) =>
    (
      await database
        .prepare(
          `SELECT ${columns} FROM live_accounts WHERE user_id=? AND chain_id=? AND wallet=? ORDER BY updated_at DESC LIMIT 50`,
        )
        .bind(user, CHAIN, historyAddress(wallet))
        .all<SavedLiveAccount>()
    ).results;
  async function remember(
    user: string,
    a: {
      owner: string;
      account: string;
      deployment: string;
      deploymentBlock: number;
      deploymentBlockHash: string;
    },
  ) {
    const s = {
        user,
        wallet: historyAddress(a.owner),
        account: historyAddress(a.account),
      },
      now = new Date().toISOString();
    const prior = await getAccount(s);
    if (prior && prior.deployment !== historyHash(a.deployment))
      throw Error('The saved deployment identity changed.');
    if (
      prior &&
      (prior.deploymentBlock !== a.deploymentBlock ||
        prior.deploymentBlockHash !== historyHash(a.deploymentBlockHash))
    ) {
      const operation = crypto.randomUUID();
      await database.batch([
        database
          .prepare(
            `UPDATE live_accounts SET deployment_block=?,deployment_block_hash=?,synced_block=NULL,synced_block_hash=NULL,head_block=NULL,version=version+1,operation=?,updated_at=? WHERE ${where} AND version=?`,
          )
          .bind(
            a.deploymentBlock,
            historyHash(a.deploymentBlockHash),
            operation,
            now,
            ...scopeValues(s),
            prior.version,
          ),
        database
          .prepare(
            `UPDATE live_transactions SET status='rechecking' WHERE ${where} AND EXISTS(SELECT 1 FROM live_accounts WHERE ${where} AND operation=?)`,
          )
          .bind(...scopeValues(s), ...scopeValues(s), operation),
      ]);
    }
    await database
      .prepare(
        `INSERT INTO live_accounts(user_id,chain_id,wallet,account,deployment,deployment_block,deployment_block_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,chain_id,wallet,account) DO NOTHING`,
      )
      .bind(
        ...scopeValues(s),
        historyHash(a.deployment),
        a.deploymentBlock,
        historyHash(a.deploymentBlockHash),
        now,
        now,
      )
      .run();
    const saved = await getAccount(s);
    if (
      !saved ||
      saved.deployment !== historyHash(a.deployment) ||
      saved.deploymentBlockHash !== historyHash(a.deploymentBlockHash)
    )
      throw Error('The position could not be saved.');
    return saved;
  }
  async function page(s: Scope, offset = 0) {
    const account = await getAccount(s);
    if (!account) return { account: null, records: [], nextOffset: null };
    const rows = await database
      .prepare(
        `SELECT record,status FROM live_transactions WHERE ${where} ORDER BY COALESCE(block,9007199254740991) DESC,transaction_index DESC,hash DESC LIMIT 51 OFFSET ?`,
      )
      .bind(...scopeValues(s), offset)
      .all<{ record: string; status: HistoryRecord['status'] }>();
    return {
      account,
      records: rows.results
        .slice(0, 50)
        .map((r) => ({
          ...(JSON.parse(r.record) as HistoryRecord),
          status: r.status,
        })),
      nextOffset: rows.results.length > 50 ? offset + 50 : null,
    };
  }
  async function candidates(s: Scope, from: number, to: number) {
    const range = await database
      .prepare(
        `SELECT record,status FROM live_transactions WHERE ${where} AND block BETWEEN ? AND ? ORDER BY block ASC LIMIT 21`,
      )
      .bind(...scopeValues(s), from, to)
      .all<{ record: string; status: HistoryRecord['status'] }>();
    const pending = await database
      .prepare(
        `SELECT record,status FROM live_transactions WHERE ${where} AND block IS NULL AND status IN ('pending','rechecking') ORDER BY updated_at ASC,hash ASC LIMIT 10`,
      )
      .bind(...scopeValues(s))
      .all<{ record: string; status: HistoryRecord['status'] }>();
    return {
      rangeTooLarge: range.results.length > 20,
      records: [...range.results, ...pending.results].map((r) => ({
        ...(JSON.parse(r.record) as HistoryRecord),
        status: r.status,
      })),
    };
  }
  async function transaction(s: Scope, hash: string) {
    const row = await database
      .prepare(
        `SELECT record,status FROM live_transactions WHERE ${where} AND hash=?`,
      )
      .bind(...scopeValues(s), historyHash(hash))
      .first<{ record: string; status: HistoryRecord['status'] }>();
    return row
      ? { ...(JSON.parse(row.record) as HistoryRecord), status: row.status }
      : null;
  }
  async function nonceRecords(s: Scope, nonce: string) {
    const rows = await database
      .prepare(
        `SELECT record,status FROM live_transactions WHERE ${where} AND json_extract(record,'$.nonce')=? LIMIT 33`,
      )
      .bind(...scopeValues(s), nonce)
      .all<{ record: string; status: HistoryRecord['status'] }>();
    if (rows.results.length > 32)
      throw Error('Too many linked replacements to reconcile in one request.');
    return rows.results.map((r) => ({
      ...(JSON.parse(r.record) as HistoryRecord),
      status: r.status,
    }));
  }
  async function commit(
    s: Scope,
    previous: SavedLiveAccount,
    records: HistoryRecord[],
    checkpoint?: {
      block: number;
      hash: string;
      head: number;
      reset: boolean;
      from: number;
    },
  ) {
    const id = crypto.randomUUID(),
      now = new Date().toISOString();
    const guard = `EXISTS(SELECT 1 FROM live_accounts WHERE ${where} AND operation=?)`;
    const statements = [
      database
        .prepare(
          `UPDATE live_accounts SET version=version+1,operation=?,updated_at=?,synced_block=?,synced_block_hash=?,head_block=? WHERE ${where} AND version=?`,
        )
        .bind(
          id,
          now,
          checkpoint?.block ?? previous.syncedBlock,
          checkpoint?.hash ?? previous.syncedBlockHash,
          checkpoint?.head ?? previous.headBlock,
          ...scopeValues(s),
          previous.version,
        ),
    ];
    if (checkpoint?.reset)
      statements.push(
        database
          .prepare(
            `UPDATE live_transactions SET status='rechecking' WHERE ${where} AND block IS NOT NULL AND ${guard}`,
          )
          .bind(...scopeValues(s), ...scopeValues(s), id),
      );
    if (checkpoint)
      statements.push(
        database
          .prepare(
            `UPDATE live_transactions SET status='rechecking' WHERE ${where} AND block BETWEEN ? AND ? AND ${guard}`,
          )
          .bind(
            ...scopeValues(s),
            checkpoint.from,
            checkpoint.block,
            ...scopeValues(s),
            id,
          ),
      );
    for (const r of records) {
      if (
        r.chainId !== CHAIN ||
        historyAddress(r.wallet) !== historyAddress(s.wallet) ||
        historyAddress(r.account) !== historyAddress(s.account)
      )
        throw Error('Activity scope mismatch.');
      statements.push(
        database
          .prepare(
            `INSERT INTO live_transactions(user_id,chain_id,wallet,account,hash,block,transaction_index,status,record,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${guard} ON CONFLICT(user_id,chain_id,wallet,account,hash) DO UPDATE SET block=excluded.block,transaction_index=excluded.transaction_index,status=excluded.status,record=excluded.record,updated_at=excluded.updated_at`,
          )
          .bind(
            ...scopeValues(s),
            historyHash(r.hash),
            r.block,
            r.transactionIndex,
            r.status,
            JSON.stringify(r),
            now,
            ...scopeValues(s),
            id,
          ),
      );
    }
    await database.batch(statements);
    const applied = await database
      .prepare(`SELECT operation FROM live_accounts WHERE ${where}`)
      .bind(...scopeValues(s))
      .first<{ operation: string }>();
    if (applied?.operation !== id)
      throw Error('Another history update finished first. Refresh to load it.');
  }
  return {
    getAccount,
    list,
    remember,
    page,
    candidates,
    transaction,
    nonceRecords,
    commit,
  };
}
