import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { localWalletSession } from './local-wallet-session.mjs';
const origin = new URL(process.env.TEST_ORIGIN || 'http://localhost:3015');
assert.ok(
  ['localhost', '127.0.0.1'].includes(origin.hostname),
  'Local test only',
);
assert.equal(origin.protocol, 'http:');
assert.equal(
  origin.username + origin.password + origin.search + origin.hash,
  '',
);
let checks = 0;
async function request(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  if (options.cookie) headers.set('cookie', options.cookie);
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    if (!headers.has('origin')) headers.set('origin', origin.origin);
  }
  const response = await fetch(new URL(path, origin), {
    method: options.body === undefined ? 'GET' : 'POST',
    redirect: 'error',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json();
  assert.match(response.headers.get('cache-control'), /no-store/);
  checks++;
  return { response, data };
}
const a = await localWalletSession(origin),
  b = Wallet.createRandom(),
  hash = `0x${'1'.repeat(64)}`;
for (const [path, key] of [
  ['wallet', 'address'],
  ['deposit-preview', 'address'],
  ['account-plan', 'address'],
  ['pilot/account', 'owner'],
  ['pilot/prepare', 'owner'],
  ['pilot/receipt', 'owner'],
  ['history', 'owner'],
]) {
  const route = `/api/live/${path}?${key}=${b.address}&action=deploy&deployment=${hash}&hash=${hash}`;
  assert.equal((await request(route)).response.status, 401);
  assert.equal(
    (await request(route, { cookie: a.cookie })).response.status,
    403,
  );
  assert.equal(
    (
      await request(route, {
        headers: {
          'oai-authenticated-user-id': 'forged',
          'oai-authenticated-user-email': 'forged@example.test',
        },
      })
    ).response.status,
    401,
  );
}
assert.equal(
  (
    await request('/api/live/history', {
      cookie: a.cookie,
      body: { action: 'remember', owner: b.address, deployment: hash },
    })
  ).response.status,
  403,
);
assert.equal(
  (
    await request(`/api/live/history?owner=${a.wallet.address.toLowerCase()}`, {
      cookie: a.cookie,
    })
  ).response.status,
  200,
);
console.log(
  'PASS all live owner routes reject cross-wallet and forged platform identity',
);

const challenge = await request('/api/auth/challenge', {
  body: { address: b.address },
});
assert.equal(challenge.response.status, 200);
const binding = challenge.response.headers.getSetCookie()[0];
assert.match(binding, /^__Host-freestock-challenge=/);
assert.match(binding, /HttpOnly; Secure; SameSite=Lax/);
const signature = await b.signMessage(challenge.data.message),
  body = { id: challenge.data.id, signature };
assert.equal(
  (await request('/api/auth/verify', { body })).response.status,
  401,
);
assert.equal(
  (
    await request('/api/auth/verify', {
      cookie: binding,
      body,
      headers: { origin: 'https://evil.example' },
    })
  ).response.status,
  403,
);
const replay = await Promise.all([
  request('/api/auth/verify', { body, cookie: binding }),
  request('/api/auth/verify', { body, cookie: binding }),
]);
assert.deepEqual(replay.map((r) => r.response.status).sort((a, b) => a - b), [200, 401]);
const success = replay.find((r) => r.response.status === 200);
const cookie = success.response.headers
  .getSetCookie()
  .find((v) => v.startsWith('__Host-freestock-wallet='));
assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
assert.equal(
  (await request('/api/auth/session', { cookie })).data.wallet,
  b.address,
);
assert.equal(
  (await request('/api/auth/logout', { cookie, body: {} })).response.status,
  200,
);
assert.equal(
  (await request('/api/auth/session', { cookie })).data.wallet,
  null,
);
assert.equal(
  (
    await request('/api/auth/challenge', {
      body: { address: b.address, padding: 'x'.repeat(2200) },
    })
  ).response.status,
  413,
);
console.log(
  'PASS browser-bound challenge, concurrent replay, cookie flags, logout and body limits',
);

const demo = await request('/api/demo/session', { body: {} });
assert.equal(demo.response.status, 200);
const demoCookie = demo.response.headers.getSetCookie()[0];
const account = await request('/api/earn/account', { cookie: demoCookie });
assert.equal(account.response.status, 200);
assert.equal(account.data.mode, 'simulation');
assert.equal(
  (
    await request(`/api/live/wallet?address=${b.address}`, {
      cookie: demoCookie,
    })
  ).response.status,
  401,
);
assert.equal(
  (
    await request('/api/demo/session', {
      body: {},
      headers: { origin: 'https://evil.example' },
    })
  ).response.status,
  403,
);
console.log(
  `PASS ${checks} wallet authentication and anonymous-demo HTTP checks. No financial transactions submitted.`,
);
