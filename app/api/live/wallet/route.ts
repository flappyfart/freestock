import {
  AuthError,
  requireWalletOwner,
} from '../../../../lib/wallet-auth-service';
import { identity, json } from '../../../../lib/http';
import { walletSnapshot } from '../../../../lib/live/chain';
import { LiveError } from '../../../../lib/live/config';
export async function GET(request: Request) {
  const user = await identity();
  if (!user)
    return json({ error: 'Connect your wallet to inspect a wallet.' }, 401);
  try {
    requireWalletOwner(user, new URL(request.url).searchParams.get('address'));
    return json(
      await walletSnapshot(
        new URL(request.url).searchParams.get('address') ?? '',
      ),
    );
  } catch (e) {
    return json(
      {
        error:
          e instanceof LiveError || e instanceof AuthError
            ? e.message
            : 'Wallet data could not be loaded.',
      },
      e instanceof LiveError || e instanceof AuthError ? e.status : 503,
    );
  }
}
