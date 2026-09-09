import { json } from '../../../../lib/http';
import {
  auth,
  authBody,
  authCookie,
  readCookie,
  SESSION_COOKIE,
  CHALLENGE_COOKIE,
} from '../../../../lib/wallet-auth';
import { AuthError } from '../../../../lib/wallet-auth-service';
export async function POST(request: Request) {
  try {
    await authBody(request);
    await auth().logout(
      readCookie(request.headers.get('cookie'), SESSION_COOKIE),
    );
    const response = json({ disconnected: true });
    response.headers.append('Set-Cookie', authCookie(SESSION_COOKIE, '', 0));
    response.headers.append('Set-Cookie', authCookie(CHALLENGE_COOKIE, '', 0));
    return response;
  } catch (e) {
    return json(
      {
        error:
          e instanceof AuthError
            ? e.message
            : 'Could not close this wallet session. Please retry.',
      },
      e instanceof AuthError ? e.status : 503,
    );
  }
}
