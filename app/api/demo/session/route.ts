import { json } from '../../../../lib/http';
import { authBody, authCookie, readCookie } from '../../../../lib/wallet-auth';
import { AuthError, randomToken } from '../../../../lib/wallet-auth-service';
import { DEMO_COOKIE } from '../../../../lib/demo-session';
export async function POST(request: Request) {
  try {
    await authBody(request);
    const token =
      readCookie(request.headers.get('cookie'), DEMO_COOKIE) ?? randomToken();
    const response = json({ mode: 'simulation', realDepositsEnabled: false });
    response.headers.append(
      'Set-Cookie',
      authCookie(DEMO_COOKIE, token, 30 * 24 * 60 * 60),
    );
    return response;
  } catch (e) {
    return json(
      {
        error: e instanceof AuthError ? e.message : 'Could not open the demo.',
      },
      e instanceof AuthError ? e.status : 503,
    );
  }
}
