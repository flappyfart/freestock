import { env } from 'cloudflare:workers';
import { db } from '../../../../lib/earn-store';
import { json } from '../../../../lib/http';
import {
  runMonitor,
  validMonitorToken,
} from '../../../../lib/live/agent-monitor';
import { checkAgentPlan } from '../../../../lib/live/agent-service';
import {
  deliverPurchasePush,
  pushConfig,
} from '../../../../lib/live/purchase-push';
export async function POST(request: Request) {
  if (
    !(await validMonitorToken(
      request.headers.get('authorization'),
      (env as unknown as Record<string, unknown>).AGENT_MONITOR_TOKEN,
    ))
  )
    return json({ error: 'Unauthorized' }, 401);
  try {
    const database = db(),
      result = await runMonitor(database, (s) =>
        checkAgentPlan(database, s, 'background'),
      );
    const push = await deliverPurchasePush(
      database,
      pushConfig(env as unknown as Record<string, unknown>),
    );
    return json({ ...result, push }, result.failed || push.failed ? 503 : 200);
  } catch {
    return json(
      { error: 'Monitoring could not complete. No transaction was sent.' },
      503,
    );
  }
}
