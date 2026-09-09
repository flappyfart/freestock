import { localWalletSession } from './local-wallet-session.mjs';
import assert from 'node:assert/strict';
const origin = new URL(process.env.TEST_ORIGIN || 'http://localhost:3012');
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname),
  'Local test only',
);
assert.equal(origin.protocol, 'http:');
assert.equal(
  origin.username + origin.password + origin.search + origin.hash,
  '',
);
const primary = await localWalletSession(origin);
const wallet = primary.wallet.address;
const sessions = new Map([['live-integration-test', Promise.resolve(primary)]]);
let requests = 0;
async function get(
  path,
  authenticated = true,
  userId = 'live-integration-test',
) {
  requests++;
  if (authenticated && !sessions.has(userId))
    sessions.set(userId, localWalletSession(origin));
  const r = await fetch(new URL(path, origin), {
    redirect: 'error',
    headers: authenticated
      ? { cookie: (await sessions.get(userId)).cookie }
      : {},
  });
  assert.match(r.headers.get('cache-control'), /no-store/);
  return { status: r.status, data: await r.json() };
}
for (const route of [
  'wallet',
  'quote',
  'deposit-preview',
  'account-plan',
  'pilot/prepare',
  'pilot/account',
  'pilot/receipt',
]) {
  assert.equal((await get(`/api/live/${route}`, false)).status, 401);
}
console.log('PASS authentication on all seven account/quote/pilot routes');
for (const path of [
  'wallet?address=no',
  'deposit-preview?address=' + wallet + '&amount=100.0000001',
  'quote?symbol=UNKNOWN&amount=10',
  'quote?symbol=NVDA&amount=1e2',
]) {
  assert.equal((await get(`/api/live/${path}`)).status, 400);
}
console.log('PASS exact amount, stock and address validation');
const status = (await get('/api/live/status', false)).data;
assert.equal(status.chainId, 4663);
assert.equal(status.realDepositsEnabled, false);
assert.equal(status.realTradingEnabled, false);
assert.equal(status.backgroundAutomationEnabled, false);
assert.equal(status.sessionScope, null);
const firstUser = (await get('/api/live/status')).data;
const secondUser = (await get('/api/live/status', true, 'second-live-user'))
  .data;
for (const value of [firstUser, secondUser]) {
  assert.equal(value.walletTransactionsEnabled, true);
  assert.equal(value.realDepositsEnabled, true);
  assert.equal(value.realTradingEnabled, true);
  assert.equal(value.backgroundAutomationEnabled, false);
  assert.match(value.sessionScope, /^[a-f0-9]{64}$/);
}
assert.notEqual(firstUser.sessionScope, secondUser.sessionScope);
console.log(
  'PASS independent wallet profiles, anonymous denial and session isolation',
);
const balance = await get(`/api/live/wallet?address=${wallet}`);
assert.equal(balance.status, 200, JSON.stringify(balance.data));
assert.equal(balance.data.mode, 'mainnet-read-only');
assert.equal(balance.data.stocks.length, 6);
assert.ok(balance.data.block > 58051564);
assert.ok(BigInt(balance.data.usdg) >= 0n);
console.log('PASS actual mainnet balances and read-only wallet endpoint');
const quote = await get('/api/live/quote?symbol=NVDA&amount=10');
assert.equal(quote.status, 200, JSON.stringify(quote.data));
assert.equal(quote.data.amountIn, '10000000');
assert.ok(BigInt(quote.data.amountOut) > 0n);
assert.ok(BigInt(quote.data.minimumOut) < BigInt(quote.data.amountOut));
assert.equal(quote.data.executionEnabled, false);
assert.equal((await get('/api/live/quote?symbol=MSFT&amount=10')).status, 422);
console.log('PASS live NVIDIA quote and missing Microsoft route rejection');
const preview = await get(
  `/api/live/deposit-preview?address=${wallet}&amount=10`,
);
assert.equal(preview.status, 200, JSON.stringify(preview.data));
assert.equal(preview.data.simulation, 'needs-balance');
assert.equal(preview.data.canSubmit, false);
const setup = await get(`/api/live/account-plan?address=${wallet}`);
assert.equal(setup.status, 200, JSON.stringify(setup.data));
assert.equal(setup.data.simulation, 'passed');
assert.equal(setup.data.canSubmit, false);
assert.equal(setup.data.transaction.from, wallet);
assert.equal(setup.data.depositLimit, ((1n << 256n) - 1n).toString());
assert.equal(setup.data.accountVersion, 'v2');
assert.equal(setup.data.uncapped, true);
assert.deepEqual(setup.data.stocks, ['NVDA', 'AAPL', 'TSLA', 'GOOGL', 'SPY']);
console.log(
  'PASS direct deposit preview and actual-chain account creation simulation',
);
console.log(
  `${requests} read-only API checks passed; only disposable local authentication messages signed; no token approvals or financial transactions submitted.`,
);
