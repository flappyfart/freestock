import { getAddress, verifyMessage } from 'ethers';

export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const CHALLENGE_SECONDS = 5 * 60;
export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}
export type WalletSession = {
  userId: string;
  wallet: string;
  expiresAt: number;
};
type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};
type Database = {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
};
type Challenge = {
  id: string;
  wallet: string;
  origin: string;
  message: string;
  expires_at: number;
  binding_hash: string;
  consumed_by: string | null;
};
export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function tokenHash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export function walletIdentity(wallet: string) {
  return `wallet:4663:${getAddress(wallet).toLowerCase()}`;
}
export function requireWalletOwner(userId: string, value: unknown) {
  let owner: string;
  try {
    owner = getAddress(String(value));
  } catch {
    throw new AuthError('Choose a valid wallet address.', 400);
  }
  if (walletIdentity(owner) !== userId)
    throw new AuthError(
      'Connect and confirm ownership of this wallet before using its account.',
      403,
    );
  return owner;
}
export function createWalletAuth(
  database: Database,
  now = () => Math.floor(Date.now() / 1000),
) {
  const session = async (
    token: string | undefined,
  ): Promise<WalletSession | null> => {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = await database
      .prepare(
        'SELECT wallet, expires_at FROM wallet_sessions WHERE token_hash = ? AND expires_at > ?',
      )
      .bind(await tokenHash(token), now())
      .first<{ wallet: string; expires_at: number }>();
    return row
      ? {
          userId: walletIdentity(row.wallet),
          wallet: row.wallet,
          expiresAt: row.expires_at,
        }
      : null;
  };
  return {
    session,
    async challenge(origin: string, address: string, binding: string) {
      let wallet: string;
      try {
        wallet = getAddress(address);
      } catch {
        throw new AuthError('Choose a valid wallet address.', 400);
      }
      const url = new URL(origin);
      if (
        url.origin !== origin ||
        (url.protocol !== 'https:' &&
          !(
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
          ))
      )
        throw new AuthError('Secure website connection required.', 403);
      if (!/^[a-f0-9]{64}$/.test(binding))
        throw new AuthError('Start wallet connection again.');
      const issuedAt = now(),
        expiresAt = issuedAt + CHALLENGE_SECONDS,
        id = randomToken(),
        nonce = randomToken();
      const message = `${url.host} wants you to sign in with your Ethereum account:\n${wallet}\n\nCreate or access your Freestock profile. This free signature does not move funds or approve spending.\n\nURI: ${origin}/dashboard\nVersion: 1\nChain ID: 4663\nNonce: ${nonce}\nIssued At: ${new Date(issuedAt * 1000).toISOString()}\nExpiration Time: ${new Date(expiresAt * 1000).toISOString()}`;
      await database.batch([
        database
          .prepare('DELETE FROM wallet_challenges WHERE expires_at <= ?')
          .bind(issuedAt),
        database
          .prepare('DELETE FROM wallet_sessions WHERE expires_at <= ?')
          .bind(issuedAt),
        database
          .prepare(
            'INSERT INTO wallet_challenges(id,wallet,origin,message,expires_at,binding_hash,consumed_by) VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(binding_hash) DO UPDATE SET id=excluded.id,wallet=excluded.wallet,origin=excluded.origin,message=excluded.message,expires_at=excluded.expires_at,consumed_by=NULL',
          )
          .bind(
            id,
            wallet,
            origin,
            message,
            expiresAt,
            await tokenHash(binding),
          ),
      ]);
      return { id, message, wallet, chainId: 4663, expiresAt };
    },
    async verify(
      origin: string,
      id: string,
      signature: string,
      binding: string,
      previousToken?: string,
    ) {
      if (
        !/^[a-f0-9]{64}$/.test(id) ||
        !/^[a-f0-9]{64}$/.test(binding) ||
        !/^0x[a-fA-F0-9]{130}$/.test(signature)
      )
        throw new AuthError(
          'Wallet confirmation is invalid. Please try again.',
        );
      const bindingHash = await tokenHash(binding);
      const challenge = await database
        .prepare(
          'SELECT * FROM wallet_challenges WHERE id = ? AND binding_hash = ?',
        )
        .bind(id, bindingHash)
        .first<Challenge>();
      if (
        !challenge ||
        challenge.origin !== origin ||
        challenge.expires_at <= now() ||
        challenge.consumed_by
      )
        throw new AuthError(
          'Wallet confirmation expired or was already used. Please try again.',
        );
      let signer: string;
      try {
        signer = verifyMessage(challenge.message, signature);
      } catch {
        throw new AuthError('The wallet signature could not be verified.');
      }
      if (signer !== challenge.wallet)
        throw new AuthError(
          'The signature belongs to a different wallet. Please reconnect.',
        );
      const token = randomToken(),
        hash = await tokenHash(token),
        expiresAt = now() + SESSION_SECONDS;
      // The claim and guarded insert share one transaction. A concurrent replay cannot create a session.
      await database.batch([
        database
          .prepare(
            'UPDATE wallet_challenges SET consumed_by = ? WHERE id = ? AND binding_hash = ? AND origin = ? AND consumed_by IS NULL AND expires_at > ?',
          )
          .bind(hash, id, bindingHash, origin, now()),
        database
          .prepare(
            'INSERT INTO wallet_sessions(token_hash,wallet,expires_at) SELECT ?,wallet,? FROM wallet_challenges WHERE id = ? AND consumed_by = ?',
          )
          .bind(hash, expiresAt, id, hash),
        database
          .prepare(
            'DELETE FROM wallet_sessions WHERE token_hash = ? AND EXISTS (SELECT 1 FROM wallet_sessions WHERE token_hash = ?)',
          )
          .bind(previousToken ? await tokenHash(previousToken) : '', hash),
      ]);
      const result = await session(token);
      if (!result)
        throw new AuthError(
          'Wallet confirmation was already used. Please try again.',
        );
      return { token, session: result };
    },
    async logout(token?: string) {
      if (token && /^[a-f0-9]{64}$/.test(token))
        await database
          .prepare('DELETE FROM wallet_sessions WHERE token_hash = ?')
          .bind(await tokenHash(token))
          .run();
    },
  };
}
