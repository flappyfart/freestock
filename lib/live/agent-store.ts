import { getAddress } from 'ethers';
import {
  validateAgentSettings,
  type AgentSettings,
  type CostEstimate,
} from './agent-settings.ts';
import type { AgentDecision } from './agentic-lending.ts';

type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};
export type AgentDatabase = {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
};
export type AgentScope = { userId: string; wallet: string; account: string };
export type SavedDecision = AgentDecision & {
  cost?: CostEstimate;
  assets?: string;
  block?: number;
  checkedAt: string;
  error?: boolean;
};
export type SavedAgentPlan = AgentScope & {
  deployment: string;
  settings: AgentSettings;
  revision: number;
  nextCheckAt: number;
  lastCheckedAt: number | null;
  lastDecision: SavedDecision | null;
  leaseUntil: number;
  updatedAt: number;
  failureCount: number;
};
type Row = Omit<SavedAgentPlan, 'settings' | 'lastDecision'> & {
  settings: string;
  lastDecision: string | null;
};
const fields =
  'user_id AS userId,wallet,account,deployment,settings,revision,next_check_at AS nextCheckAt,last_checked_at AS lastCheckedAt,last_decision AS lastDecision,lease_until AS leaseUntil,updated_at AS updatedAt,failure_count AS failureCount';
const where = 'user_id=? AND wallet=? AND account=?';
const values = (s: AgentScope) => [
  s.userId,
  getAddress(s.wallet).toLowerCase(),
  getAddress(s.account).toLowerCase(),
];
const decode = (r: Row): SavedAgentPlan => ({
  ...r,
  settings: validateAgentSettings(JSON.parse(r.settings)),
  lastDecision: r.lastDecision
    ? (JSON.parse(r.lastDecision) as SavedDecision)
    : null,
});
export class AgentStoreError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.status = status;
  }
}
export function createAgentStore(
  db: AgentDatabase,
  clock = () => Math.floor(Date.now() / 1000),
) {
  const get = async (s: AgentScope) => {
    const row = await db
      .prepare(`SELECT ${fields} FROM agent_plans WHERE ${where}`)
      .bind(...values(s))
      .first<Row>();
    return row ? decode(row) : null;
  };
  async function save(
    s: AgentScope,
    deployment: string,
    input: unknown,
    revision: number,
  ) {
    const settings = validateAgentSettings(input),
      now = clock();
    if (
      !/^0x[\da-f]{64}$/i.test(deployment) ||
      !Number.isSafeInteger(revision) ||
      revision < 0
    )
      throw new AgentStoreError('Invalid saved plan.', 400);
    const result =
      revision === 0
        ? await db
            .prepare(
              `INSERT INTO agent_plans(user_id,wallet,account,deployment,settings,revision,monitoring,next_check_at,updated_at) VALUES(?,?,?,?,?,1,?,?,?) ON CONFLICT(user_id,wallet,account) DO NOTHING RETURNING revision`,
            )
            .bind(
              ...values(s),
              deployment.toLowerCase(),
              JSON.stringify(settings),
              settings.monitoring && !settings.plan.paused ? 1 : 0,
              now,
              now,
            )
            .first<{ revision: number }>()
        : await db
            .prepare(
              `UPDATE agent_plans SET settings=?,revision=revision+1,monitoring=?,next_check_at=?,lease_token=NULL,lease_until=0,failure_count=0,last_decision=NULL,updated_at=? WHERE ${where} AND revision=? AND deployment=? RETURNING revision`,
            )
            .bind(
              JSON.stringify(settings),
              settings.monitoring && !settings.plan.paused ? 1 : 0,
              now,
              now,
              ...values(s),
              revision,
              deployment.toLowerCase(),
            )
            .first<{ revision: number }>();
    if (!result)
      throw new AgentStoreError(
        'This plan changed on another device. Reload it before saving again.',
      );
    return get(s);
  }
  async function history(s: AgentScope) {
    const rows = await db
      .prepare(
        `SELECT id,revision,source,decision,created_at AS createdAt FROM agent_decisions WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 50`,
      )
      .bind(...values(s))
      .all<{
        id: string;
        revision: number;
        source: string;
        decision: string;
        createdAt: number;
      }>();
    return rows.results.map((r) => ({
      ...r,
      decision: JSON.parse(r.decision) as SavedDecision,
    }));
  }
  async function claim(s: AgentScope, revision: number, manual = false) {
    const now = clock(),
      token = crypto.randomUUID();
    const r = await db
      .prepare(
        `UPDATE agent_plans SET lease_token=?,lease_until=? WHERE ${where} AND revision=? AND lease_until<=? AND (?=1 OR (monitoring=1 AND next_check_at<=?)) AND (last_checked_at IS NULL OR last_checked_at<=?) RETURNING revision`,
      )
      .bind(
        token,
        now + 180,
        ...values(s),
        revision,
        now,
        manual ? 1 : 0,
        now,
        now - 30,
      )
      .first<{ revision: number }>();
    return r ? token : null;
  }
  async function finish(
    s: SavedAgentPlan,
    token: string,
    decision: SavedDecision,
    source: 'manual' | 'background',
  ) {
    const now = clock(),
      id = crypto.randomUUID(),
      record = JSON.stringify(decision);
    if (record.length > 8192) throw Error('Decision exceeds storage limit.');
    const failures = decision.error ? Math.min(s.failureCount + 1, 6) : 0;
    const interval = decision.error
      ? Math.min(3600, 60 * 2 ** failures)
      : s.settings.intervalMinutes * 60;
    await db.batch([
      db
        .prepare(
          `INSERT INTO agent_decisions(id,user_id,wallet,account,revision,source,decision,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM agent_plans WHERE ${where} AND revision=? AND lease_token=?)`,
        )
        .bind(
          id,
          ...values(s),
          s.revision,
          source,
          record,
          now,
          ...values(s),
          s.revision,
          token,
        ),
      db
        .prepare(
          `UPDATE agent_plans SET last_decision=?,last_checked_at=?,next_check_at=?,failure_count=?,lease_token=NULL,lease_until=0 WHERE ${where} AND revision=? AND lease_token=?`,
        )
        .bind(
          record,
          now,
          now + interval,
          failures,
          ...values(s),
          s.revision,
          token,
        ),
      db
        .prepare(
          `DELETE FROM agent_decisions WHERE ${where} AND id NOT IN (SELECT id FROM agent_decisions WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 100)`,
        )
        .bind(...values(s), ...values(s)),
    ]);
    const applied = await db
      .prepare('SELECT id FROM agent_decisions WHERE id=?')
      .bind(id)
      .first<{ id: string }>();
    return !!applied;
  }
  async function due(limit = 3) {
    const now = clock();
    const rows = await db
      .prepare(
        `SELECT ${fields} FROM agent_plans WHERE monitoring=1 AND next_check_at<=? AND lease_until<=? ORDER BY next_check_at ASC,user_id,wallet,account LIMIT ?`,
      )
      .bind(now, now, Math.max(1, Math.min(5, limit)))
      .all<Row>();
    return rows.results.map(decode);
  }
  async function remove(s: AgentScope, revision: number) {
    // The revision match prevents deleting an updated plan; stale in-flight checks lose their lease.
    const token = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `UPDATE agent_plans SET lease_token=?,lease_until=?,monitoring=0 WHERE ${where} AND revision=?`,
        )
        .bind(token, clock() + 180, ...values(s), revision),
      db
        .prepare(
          `DELETE FROM agent_decisions WHERE ${where} AND EXISTS(SELECT 1 FROM agent_plans WHERE ${where} AND lease_token=?)`,
        )
        .bind(...values(s), ...values(s), token),
      db
        .prepare(`DELETE FROM agent_plans WHERE ${where} AND lease_token=?`)
        .bind(...values(s), token),
    ]);
    if (await get(s))
      throw new AgentStoreError(
        'This plan changed on another device. Reload it before removing.',
      );
  }
  return { get, save, history, claim, finish, due, remove };
}
