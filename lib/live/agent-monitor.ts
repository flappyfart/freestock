import type { AgentDatabase } from './agent-store.ts';
import { createAgentStore } from './agent-store.ts';

const NAME = 'agent-monitor';
export async function monitorHealth(
  db: AgentDatabase,
  now = Math.floor(Date.now() / 1000),
) {
  const row = await db
    .prepare(
      'SELECT started_at AS startedAt,completed_at AS completedAt,status FROM service_checks WHERE name=?',
    )
    .bind(NAME)
    .first<{ startedAt: number; completedAt: number | null; status: string }>();
  return {
    status: !row
      ? 'not_started'
      : row.status === 'running' && now - row.startedAt < 240
        ? 'running'
        : row.status === 'ok' && row.completedAt && now - row.completedAt < 2700
          ? 'healthy'
          : 'delayed',
    lastCompletedAt: row?.completedAt ?? null,
  };
}
export async function runMonitor(
  db: AgentDatabase,
  check: (
    saved: Awaited<
      ReturnType<ReturnType<typeof createAgentStore>['due']>
    >[number],
  ) => Promise<{ applied: boolean; busy: boolean }>,
  clock = () => Math.floor(Date.now() / 1000),
) {
  const now = clock(),
    runId = crypto.randomUUID();
  const claim = await db
    .prepare(
      `INSERT INTO service_checks(name,started_at,completed_at,status,details) VALUES(?,?,NULL,'running',?) ON CONFLICT(name) DO UPDATE SET started_at=excluded.started_at,status='running',details=excluded.details WHERE service_checks.started_at<=? RETURNING name`,
    )
    .bind(NAME, now, runId, now - 240)
    .first();
  if (!claim) return { busy: true, checked: 0, failed: 0 };
  let checked = 0,
    failed = 0;
  try {
    const store = createAgentStore(db, clock);
    for (const plan of await store.due(3)) {
      if (clock() - now > 120) break;
      try {
        const result = await check(plan);
        if (result.applied) {
          checked++;
          if ((await store.get(plan))?.lastDecision?.error) failed++;
        }
      } catch {
        failed++;
      }
    }
    await db
      .prepare(
        'UPDATE service_checks SET completed_at=?,status=?,details=? WHERE name=? AND details=?',
      )
      .bind(
        clock(),
        failed ? 'degraded' : 'ok',
        JSON.stringify({ checked, failed }),
        NAME,
        runId,
      )
      .run();
    return { busy: false, checked, failed };
  } catch {
    await db
      .prepare(
        "UPDATE service_checks SET completed_at=?,status='failed',details=? WHERE name=? AND details=?",
      )
      .bind(
        clock(),
        JSON.stringify({ checked, failed: failed + 1 }),
        NAME,
        runId,
      )
      .run();
    throw Error('Monitoring could not complete.');
  }
}
export async function validMonitorToken(
  given: string | null,
  expected: unknown,
) {
  if (
    typeof expected !== 'string' ||
    expected.length < 32 ||
    !given ||
    given.length > 256
  )
    return false;
  const hash = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    );
  const [a, b] = await Promise.all([hash(given), hash(`Bearer ${expected}`)]);
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a[i] ^ b[i];
  return different === 0;
}
