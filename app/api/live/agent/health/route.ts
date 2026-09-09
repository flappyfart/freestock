import { db } from '../../../../../lib/earn-store';
import { json } from '../../../../../lib/http';
import { monitorHealth } from '../../../../../lib/live/agent-monitor';
export async function GET() {
  try {
    return json(await monitorHealth(db()));
  } catch {
    return json({ status: 'unavailable', lastCompletedAt: null }, 503);
  }
}
