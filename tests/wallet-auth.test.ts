import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { Wallet } from 'ethers';
import {
  createWalletAuth,
  randomToken,
  tokenHash,
  requireWalletOwner,
  walletIdentity,
  SESSION_SECONDS,
} from '../lib/wallet-auth-service.ts';

function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(
    readFileSync(
      new URL('../drizzle/0003_wallet_sessions.sql', import.meta.url),
      'utf8',
    ),
  );
  type Database = Parameters<typeof createWalletAuth>[0];
  function statement(
    query: string,
    values: unknown[] = [],
  ): ReturnType<Database['prepare']> {
    const args = () => values as (string | number | null)[];
    return {
      bind: (...v) => statement(query, v),
      first: async <T>() => (sql.prepare(query).get(...args()) as T) ?? null,
      run: async () => sql.prepare(query).run(...args()),
    };
  }
  let queue: Promise<unknown[]> = Promise.resolve([]);
  const database: Database = {
    prepare: statement,
    batch: (statements) => {
      const job = queue.then(async () => {
        sql.exec('BEGIN');
        try {
          const rows = [];
          for (const s of statements) rows.push(await s.run());
          sql.exec('COMMIT');
          return rows;
        } catch (e) {
          sql.exec('ROLLBACK');
          throw e;
        }
      });
      queue = job.catch(() => []);
      return job;
    },
  };
  let clock = 1800000000;
  const auth = createWalletAuth(database, () => clock),
    wallet = Wallet.createRandom(),
    binding = randomToken(),
    origin = 'https://tryfreestock.com';
  return {
    sql,
    auth,
    wallet,
    binding,
    origin,
    advance: (seconds: number) => {
      clock += seconds;
    },
    challenge: () => auth.challenge(origin, wallet.address, binding),
  };
}

void test('wallet signature creates a stable wallet profile and stores only a hashed session token', async () => {
  const f = fixture(),
    challenge = await f.challenge();
  assert.match(
    challenge.message,
    /^tryfreestock\.com wants you to sign in with your Ethereum account:/,
  );
  assert.match(challenge.message, /Chain ID: 4663\nNonce: [a-f0-9]{64}/);
  const result = await f.auth.verify(
    f.origin,
    challenge.id,
    await f.wallet.signMessage(challenge.message),
    f.binding,
  );
  assert.equal(result.session.userId, walletIdentity(f.wallet.address));
  assert.deepEqual(await f.auth.session(result.token), result.session);
  const stored = f.sql.prepare('SELECT * FROM wallet_sessions').get();
  assert.equal(stored?.token_hash, await tokenHash(result.token));
  assert.ok(!JSON.stringify(stored).includes(result.token));
  assert.equal(await f.auth.session(randomToken()), null);
  assert.equal(await f.auth.session('forged'), null);
  f.advance(SESSION_SECONDS);
  assert.equal(await f.auth.session(result.token), null);
});

void test('signatures are bound to the exact message, origin, wallet, browser and expiry', async () => {
  const f = fixture(),
    c = await f.challenge(),
    signature = await f.wallet.signMessage(c.message);
  await assert.rejects(
    f.auth.verify('https://www.tryfreestock.com', c.id, signature, f.binding),
  );
  await assert.rejects(f.auth.verify(f.origin, c.id, signature, randomToken()));
  await assert.rejects(
    f.auth.verify(
      f.origin,
      c.id,
      await Wallet.createRandom().signMessage(c.message),
      f.binding,
    ),
  );
  for (const message of [
    c.message.replace('Chain ID: 4663', 'Chain ID: 1'),
    c.message.replace('tryfreestock.com', 'evil.example'),
    c.message.replace(f.wallet.address, Wallet.createRandom().address),
  ]) {
    await assert.rejects(
      f.auth.verify(
        f.origin,
        c.id,
        await f.wallet.signMessage(message),
        f.binding,
      ),
    );
  }
  f.advance(300);
  await assert.rejects(f.auth.verify(f.origin, c.id, signature, f.binding));
  assert.equal(
    f.sql.prepare('SELECT count(*) n FROM wallet_sessions').get()?.n,
    0,
  );
});

void test('concurrent signature replay creates exactly one session', async () => {
  const f = fixture(),
    c = await f.challenge(),
    signature = await f.wallet.signMessage(c.message);
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      f.auth.verify(f.origin, c.id, signature, f.binding),
    ),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    f.sql.prepare('SELECT count(*) n FROM wallet_sessions').get()?.n,
    1,
  );
  await assert.rejects(f.auth.verify(f.origin, c.id, signature, f.binding));
});

void test('new challenge invalidates prior browser challenge; login rotates session; logout revokes it', async () => {
  const f = fixture(),
    old = await f.challenge(),
    c = await f.challenge();
  await assert.rejects(
    f.auth.verify(
      f.origin,
      old.id,
      await f.wallet.signMessage(old.message),
      f.binding,
    ),
  );
  const first = await f.auth.verify(
    f.origin,
    c.id,
    await f.wallet.signMessage(c.message),
    f.binding,
  );
  const next = await f.challenge();
  const second = await f.auth.verify(
    f.origin,
    next.id,
    await f.wallet.signMessage(next.message),
    f.binding,
    first.token,
  );
  assert.equal(await f.auth.session(first.token), null);
  assert.ok(await f.auth.session(second.token));
  await f.auth.logout(second.token);
  assert.equal(await f.auth.session(second.token), null);
});

void test('live owner binding rejects another wallet and platform identity strings', () => {
  const a = Wallet.createRandom(),
    b = Wallet.createRandom(),
    identity = walletIdentity(a.address);
  assert.equal(
    requireWalletOwner(identity, a.address.toLowerCase()),
    a.address,
  );
  assert.throws(() => requireWalletOwner(identity, b.address), { status: 403 });
  assert.throws(() => requireWalletOwner('forged-platform-user', a.address), {
    status: 403,
  });
  assert.throws(() => requireWalletOwner(identity, 'invalid'), { status: 400 });
});
