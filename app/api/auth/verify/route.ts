import { json } from '../../../../lib/http';
import {
  auth,
  authBody,
  authCookie,
  readCookie,
  CHALLENGE_COOKIE,
  SESSION_COOKIE,
} from '../../../../lib/wallet-auth';
import {
  AuthError,
  SESSION_SECONDS,
} from '../../../../lib/wallet-auth-service';
export async function POST(request: Request) {
  try {
    const body = await authBody(request),
      cookie = request.headers.get('cookie');
    if (typeof body.id !== 'string' || typeof body.signature !== 'string')
      throw new AuthError('Confirm the message in your wallet.', 400);
    const result = await auth().verify(
      new URL(request.url).origin,
      body.id,
      body.signature,
      readCookie(cookie, CHALLENGE_COOKIE) ?? '',
      readCookie(cookie, SESSION_COOKIE),
    );
    const response = json({
      wallet: result.session.wallet,
      expiresAt: result.session.expiresAt,
    });
    response.headers.append(
      'Set-Cookie',
      authCookie(SESSION_COOKIE, result.token, SESSION_SECONDS),
    );
    response.headers.append('Set-Cookie', authCookie(CHALLENGE_COOKIE, '', 0));
    return response;
  } catch (e) {
    return json(
      {
        error:
          e instanceof AuthError
            ? e.message
            : 'Wallet confirmation could not finish. Please retry.',
      },
      e instanceof AuthError ? e.status : 503,
    );
  }
}
