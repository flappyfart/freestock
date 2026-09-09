import {
  AuthError,
  requireWalletOwner,
} from '../../../../lib/wallet-auth-service';
import { identity, json } from '../../../../lib/http';
import { previewDeposit } from '../../../../lib/live/chain';
import { LiveError } from '../../../../lib/live/config';
export async function GET(request: Request) {
  const user = await identity();
  if (!user)
    return json({ error: 'Connect your wallet to inspect a deposit.' }, 401);
  const q = new URL(request.url).searchParams;
  try {
    requireWalletOwner(user, new URL(request.url).searchParams.get('address'));
    return json(
      await previewDeposit(q.get('address') ?? '', q.get('amount') ?? ''),
    );
  } catch (e) {
    return json(
      {
        error:
          e instanceof LiveError || e instanceof AuthError
            ? e.message
            : 'The deposit preview is unavailable.',
      },
      e instanceof LiveError || e instanceof AuthError ? e.status : 503,
    );
  }
}
