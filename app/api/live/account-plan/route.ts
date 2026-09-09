import {
  AuthError,
  requireWalletOwner,
} from '../../../../lib/wallet-auth-service';
import { identity, json } from '../../../../lib/http';
import {
  accountPlan,
  matchesAccountRuntime,
} from '../../../../lib/live/account-plan';
import { pin, rpc } from '../../../../lib/live/chain';
import { LiveError } from '../../../../lib/live/config';
export async function GET(request: Request) {
  const user = await identity();
  if (!user)
    return json(
      { error: 'Connect your wallet to prepare your account setup.' },
      401,
    );
  try {
    requireWalletOwner(user, new URL(request.url).searchParams.get('address'));
    const plan = accountPlan(
      new URL(request.url).searchParams.get('address') ?? '',
    );
    const block = await pin();
    const { from, data, value } = plan.transaction;
    const result = await rpc('eth_call', [{ from, data, value }, block]);
    if (!matchesAccountRuntime(result))
      throw new LiveError(
        'The account creation simulation did not match the tested contract.',
        503,
      );
    return json({
      ...plan,
      simulation: 'passed',
      block: Number(BigInt(block)),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    });
  } catch (e) {
    return json(
      {
        error:
          e instanceof LiveError || e instanceof AuthError
            ? e.message
            : 'The account setup could not be simulated.',
      },
      e instanceof LiveError || e instanceof AuthError ? e.status : 503,
    );
  }
}
