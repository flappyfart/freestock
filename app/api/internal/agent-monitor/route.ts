import { env } from 'cloudflare:workers';
import { db } from '../../../../lib/earn-store';
import { json } from '../../../../lib/http';
import {
  runMonitor,
  validMonitorToken,
} from '../../../../lib/live/agent-monitor';
import { checkAgentPlan } from '../../../../lib/live/agent-service';
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
    return json(result, result.failed ? 503 : 200);
  } catch {
    return json(
      { error: 'Monitoring could not complete. No transaction was sent.' },
      503,
    );
  }
}
