import { json } from '../../../../lib/http';
import {
  auth,
  authBody,
  authCookie,
  readCookie,
  CHALLENGE_COOKIE,
} from '../../../../lib/wallet-auth';
import {
  AuthError,
  CHALLENGE_SECONDS,
  randomToken,
} from '../../../../lib/wallet-auth-service';
export async function POST(request: Request) {
  try {
    const body = await authBody(request);
    if (typeof body.address !== 'string')
      throw new AuthError('Choose a wallet address.', 400);
    const binding =
      readCookie(request.headers.get('cookie'), CHALLENGE_COOKIE) ??
      randomToken();
    const challenge = await auth().challenge(
      new URL(request.url).origin,
      body.address,
      binding,
    );
    const response = json(challenge);
    response.headers.append(
      'Set-Cookie',
      authCookie(CHALLENGE_COOKIE, binding, CHALLENGE_SECONDS),
    );
    return response;
  } catch (e) {
    return json(
      {
        error:
          e instanceof AuthError
            ? e.message
            : 'Wallet connection is temporarily unavailable. Please retry.',
      },
      e instanceof AuthError ? e.status : 503,
    );
  }
}
