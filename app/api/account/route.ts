import { account } from '../../../lib/store';
import { identity, json } from '../../../lib/http';
import { LAUNCH_POLICY } from '../../../lib/launch-policy';
export async function GET() {
  const owner = await identity();
  if (!owner)
    return json({ error: 'Connect your wallet to save your preview.' }, 401);
  try {
    return json({
      ...(await account(owner)),
      mode: 'simulation',
      realDepositsEnabled: LAUNCH_POLICY.realDepositsEnabled,
      realTradingEnabled: LAUNCH_POLICY.realTradingEnabled,
      launch: LAUNCH_POLICY,
    });
  } catch {
    return json(
      { error: 'Your account could not be loaded. Please retry.' },
      503,
    );
  }
}
