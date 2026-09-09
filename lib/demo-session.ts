import { headers } from 'next/headers';
import { readCookie, walletSession } from './wallet-auth';
import { tokenHash } from './wallet-auth-service';
export const DEMO_COOKIE = '__Host-freestock-demo';
// A browser-only simulation identity has no authority on any live-wallet route.
export async function demoIdentity() {
  const token = readCookie((await headers()).get('cookie'), DEMO_COOKIE);
  if (token) return `demo:${await tokenHash(token)}`;
  return (await walletSession())?.userId ?? null;
}
