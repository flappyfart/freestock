import { getAddress } from 'ethers';
import type {
  AgentDatabase,
  AgentScope,
  SavedAgentPlan,
  SavedDecision,
} from './agent-store.ts';

export type AlertOwner = Pick<AgentScope, 'userId' | 'wallet'>;
export type PurchaseAlert = {
  id: string;
  account: string;
  deployment: string;
  revision: number;
  assets: string;
  allocations: { symbol: string; weightBps: number }[];
  createdAt: number;
  confirmedAt: number;
  readAt: number | null;
  current: boolean;
  checkUnavailable: boolean;
};
const ownerValues = (s: AlertOwner) => [
  s.userId,
  getAddress(s.wallet).toLowerCase(),
];
const scopeValues = (s: AgentScope) => [
  ...ownerValues(s),
  getAddress(s.account).toLowerCase(),
];
const scopeWhere = 'user_id=? AND wallet=? AND account=?';

// These statements run inside the same transaction as the decision/lease update.
export function alertFinishStatements(
  db: AgentDatabase,
  p: SavedAgentPlan,
  token: string,
  d: SavedDecision,
  id: string,
  now: number,
) {
  const ready =
    p.settings.purchaseAlerts &&
    !p.settings.plan.paused &&
    p.settings.plan.destination === 'stocks' &&
    d.code === 'review' &&
    d.canReview &&
    !d.error &&
    /^\d+$/.test(d.assets ?? '') &&
    BigInt(d.assets!) > 0n;
  const guard = `EXISTS(SELECT 1 FROM agent_plans WHERE ${scopeWhere} AND revision=? AND lease_token=?)`;
  const guarded = [...scopeValues(p), p.revision, token];
  const statements: ReturnType<AgentDatabase['prepare']>[] = [];
  if (ready) {
    statements.push(
      db
        .prepare(`INSERT INTO purchase_alerts(id,user_id,wallet,account,deployment,revision,assets,allocations,created_at,confirmed_at)
      SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${guard} AND NOT EXISTS(SELECT 1 FROM purchase_alerts WHERE ${scopeWhere} AND revision=? AND closed_at IS NULL)`)
        .bind(
          id,
          ...scopeValues(p),
          p.deployment,
          p.revision,
          d.assets,
          JSON.stringify(p.settings.plan.allocations),
          now,
          now,
          ...guarded,
          ...scopeValues(p),
          p.revision,
        ),
    );
    statements.push(
      db
        .prepare(
          `UPDATE purchase_alerts SET confirmed_at=?,assets=? WHERE ${scopeWhere} AND revision=? AND closed_at IS NULL AND ${guard}`,
        )
        .bind(now, d.assets, ...scopeValues(p), p.revision, ...guarded),
    );
    statements.push(
      db
        .prepare(`INSERT INTO push_deliveries(alert_id,subscription_id,subscription_version,next_attempt_at)
      SELECT a.id,s.id,s.version,? FROM purchase_alerts a JOIN push_subscriptions s ON s.user_id=a.user_id AND s.wallet=a.wallet WHERE a.id=? AND ${guard} ON CONFLICT DO NOTHING`)
        .bind(now, id, ...guarded),
    );
  } else if (!d.error && !['stale', 'quote', 'busy'].includes(d.code)) {
    // An unavailable read does not rearm alerts and spam users when the provider recovers.
    statements.push(
      db
        .prepare(
          `UPDATE purchase_alerts SET closed_at=? WHERE ${scopeWhere} AND closed_at IS NULL AND ${guard}`,
        )
        .bind(now, ...scopeValues(p), ...guarded),
    );
  }
  statements.push(
    db
      .prepare(
        `DELETE FROM push_deliveries WHERE alert_id IN (SELECT id FROM purchase_alerts WHERE ${scopeWhere} AND id NOT IN (SELECT id FROM purchase_alerts WHERE ${scopeWhere} ORDER BY created_at DESC,id DESC LIMIT 100))`,
      )
      .bind(...scopeValues(p), ...scopeValues(p)),
  );
  statements.push(
    db
      .prepare(
        `DELETE FROM purchase_alerts WHERE ${scopeWhere} AND id NOT IN (SELECT id FROM purchase_alerts WHERE ${scopeWhere} ORDER BY created_at DESC,id DESC LIMIT 100)`,
      )
      .bind(...scopeValues(p), ...scopeValues(p)),
  );
  return statements;
}

export function createPurchaseAlertStore(
  db: AgentDatabase,
  clock = () => Math.floor(Date.now() / 1000),
) {
  return {
    async list(s: AlertOwner) {
      const result = await db
        .prepare(`SELECT a.id,a.account,a.deployment,a.revision,a.assets,a.allocations,a.created_at AS createdAt,a.confirmed_at AS confirmedAt,a.read_at AS readAt,
        a.closed_at AS closedAt,p.revision AS planRevision,p.settings,p.last_decision AS lastDecision
        FROM purchase_alerts a LEFT JOIN agent_plans p ON p.user_id=a.user_id AND p.wallet=a.wallet AND p.account=a.account
        WHERE a.user_id=? AND a.wallet=? ORDER BY a.created_at DESC,a.id DESC LIMIT 50`)
        .bind(...ownerValues(s))
        .all<
          Omit<
            PurchaseAlert,
            'allocations' | 'current' | 'checkUnavailable'
          > & {
            allocations: string;
            closedAt: number | null;
            planRevision: number | null;
            settings: string | null;
            lastDecision: string | null;
          }
        >();
      return result.results.map((r): PurchaseAlert => {
        const settings = r.settings ? JSON.parse(r.settings) : null;
        const decision = r.lastDecision ? JSON.parse(r.lastDecision) : null;
        return {
          id: r.id,
          account: r.account,
          deployment: r.deployment,
          revision: r.revision,
          assets: r.assets,
          allocations: JSON.parse(r.allocations),
          createdAt: r.createdAt,
          confirmedAt: r.confirmedAt,
          readAt: r.readAt,
          current:
            r.closedAt === null &&
            r.revision === r.planRevision &&
            settings?.purchaseAlerts === true &&
            !settings.plan.paused,
          checkUnavailable:
            !!decision?.error ||
            ['stale', 'quote', 'busy'].includes(decision?.code),
        };
      });
    },
    async read(s: AlertOwner, id: string) {
      if (!/^[a-f0-9-]{36}$/.test(id)) throw Error('Choose a valid alert.');
      await db
        .prepare(
          'UPDATE purchase_alerts SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=? AND wallet=?',
        )
        .bind(clock(), id, ...ownerValues(s))
        .run();
    },
  };
}
