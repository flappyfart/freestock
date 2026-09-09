import { headers } from 'next/headers';
import { db } from './earn-store';
import { createWalletAuth, AuthError } from './wallet-auth-service';
export const SESSION_COOKIE = '__Host-freestock-wallet';
export const CHALLENGE_COOKIE = '__Host-freestock-challenge';
export function readCookie(header: string | null, name: string) {
  const value = (header ?? '')
    .split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
export function auth() {
  return createWalletAuth(db());
}
export async function walletSession() {
  return auth().session(
    readCookie((await headers()).get('cookie'), SESSION_COOKIE),
  );
}
export function authCookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export async function authBody(request: Request) {
  const expected = new URL(request.url).origin;
  if (
    request.headers.get('origin') !== expected ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new AuthError('This request must come from Freestock.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new AuthError('Use a JSON request.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError('Request body required.', 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.length;
    if (length > 2048) {
      await reader.cancel();
      throw new AuthError('Request too large.', 413);
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
    return body as Record<string, unknown>;
  } catch {
    throw new AuthError('Invalid JSON.', 400);
  }
}
