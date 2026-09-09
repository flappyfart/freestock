import { demoIdentity } from '../../../../lib/demo-session';
import { account } from '../../../../lib/earn-store';
import { json } from '../../../../lib/http';
export async function GET() {
  const owner = await demoIdentity();
  if (!owner)
    return json({ error: 'Open the demo to create a simulated account.' }, 401);
  try {
    return json({
      ...(await account(owner)),
      mode: 'simulation',
      realDepositsEnabled: false,
      realTradingEnabled: false,
    });
  } catch {
    return json(
      { error: 'Your demo account is unavailable. Please retry.' },
      503,
    );
  }
}
