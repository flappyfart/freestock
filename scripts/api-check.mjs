import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// This intentionally impersonates dispatch headers only against an isolated local
// Worker test server. The hostname guard and redirect refusal must remain intact.
const configuredOrigin = process.env.TEST_ORIGIN || 'http://localhost:3011';
let target;
try { target = new URL(configuredOrigin); } catch { throw new Error('TEST_ORIGIN must be a local HTTP origin.'); }
if (!['localhost', '127.0.0.1'].includes(target.hostname)
  || !['http:', 'https:'].includes(target.protocol)
  || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
  throw new Error('Refusing to mutate a hosted site: TEST_ORIGIN must be localhost or 127.0.0.1 with no path, credentials, query, or fragment.');
}
const ORIGIN = target.origin;
const UNIT = 1_000_000n;
const runId = `api-${Date.now()}-${randomUUID().slice(0, 8)}`;
const user = suffix => ({ id: `${runId}-${suffix}`, email: `${runId}-${suffix}@example.test` });
const alice = user('alice');
const bob = user('bob');
const drawOwner = user('draw');
const key = label => `${runId}-${label}-${randomUUID().slice(0, 8)}`;
const report = [];
let requests = 0;
let transportRetries = 0;
let serviceRetries = 0;

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const identity = options.user === undefined ? alice : options.user;
  if (identity) {
    headers.set('oai-authenticated-user-id', identity.id);
    headers.set('oai-authenticated-user-email', identity.email);
  }
  if (options.origin !== null) headers.set('origin', options.origin ?? ORIGIN);
  if (!headers.has('sec-fetch-site')) headers.set('sec-fetch-site', 'same-origin');
  let body;
  if (Object.hasOwn(options, 'raw')) body = options.raw;
  else if (Object.hasOwn(options, 'body')) body = JSON.stringify(options.body);
  if (body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (options.key) headers.set('idempotency-key', options.key);
  requests++;
  const response = await fetch(new URL(path, ORIGIN), {
    method: options.method || (body === undefined ? 'GET' : 'POST'),
    headers, body, redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`${options.method || 'request'} ${path} returned non-JSON HTTP ${response.status}: ${text.slice(0, 200)}`);
  }
  return { status: response.status, data, headers: response.headers };
}

function expectStatus(result, status) {
  assert.equal(result.status, status, `Expected HTTP ${status}; got ${result.status}: ${JSON.stringify(result.data)}`);
  assert.match(result.headers.get('cache-control') || '', /no-store/, 'Private API response must not be cached');
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff');
  return result.data;
}

async function readAccount(identity = alice) {
  const data = expectStatus(await request('/api/account', { user: identity }), 200);
  assert.equal(data.mode, 'simulation');
  assert.equal(data.realDepositsEnabled, false);
  assert.ok(Number.isSafeInteger(data.version) && data.version >= 0);
  assert.equal(BigInt(data.state.wallet) + BigInt(data.state.balance) + BigInt(data.state.pending), 10_000n * UNIT);
  return data;
}

async function command(identity, body, commandKey = key(body.type)) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let result;
    try {
      result = await request('/api/commands', { user: identity, body, key: commandKey });
    } catch (error) {
      if (attempt === 4) throw error;
      transportRetries++;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
      continue;
    }
    if (result.status === 503 && attempt < 4) {
      serviceRetries++;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
      continue;
    }
    const data = expectStatus(result, 200);
    assert.equal(data.receipt.key, commandKey);
    assert.ok(Number.isSafeInteger(data.receipt.version) && data.receipt.version > 0);
    assert.ok(data.version >= data.receipt.version);
    assert.equal(typeof data.replayed, 'boolean');
    return data;
  }
  throw new Error(`Could not confirm command ${commandKey}; retry this same key.`);
}

async function rejected(body, status, options = {}) {
  return expectStatus(await request('/api/commands', { body, key: key('rejected'), ...options }), status);
}

async function check(name, fn) {
  await fn();
  report.push(name);
  console.log(`PASS ${name}`);
}

async function main() {
  console.log(`Local paper API checks: ${ORIGIN}; isolated identities ${runId}`);
  await check('health explicitly identifies simulation with live actions disabled', async () => {
    const health = expectStatus(await request('/api/health', { user: null }), 200);
    assert.equal(health.product, 'freestock');
    assert.equal(health.mode, 'simulation');
    assert.equal(health.realDepositsEnabled, false);
    assert.equal(health.realTradingEnabled, false);
  });

  await check('account reads and mutations require complete dispatch identity', async () => {
    expectStatus(await request('/api/account', { user: null }), 401);
    await rejected({ type: 'deposit', amount: '1' }, 401, { user: null });
    expectStatus(await request('/api/account', { user: null, headers: { 'oai-authenticated-user-id': alice.id } }), 401);
    expectStatus(await request('/api/account', { user: null, headers: { 'oai-authenticated-user-email': alice.email } }), 401);
  });

  await check('foreign, absent, null, and cross-site origins cannot mutate state', async () => {
    const body = { type: 'deposit', amount: '1' };
    await rejected(body, 403, { origin: 'https://foreign.example' });
    await rejected(body, 403, { origin: null });
    await rejected(body, 403, { origin: 'null' });
    await rejected(body, 403, { headers: { 'sec-fetch-site': 'cross-site' } });
  });

  await check('malformed JSON, oversized bodies, wrong media type, and invalid request keys reject', async () => {
    expectStatus(await request('/api/commands', { raw: '{', key: key('json') }), 400);
    expectStatus(await request('/api/commands', { raw: JSON.stringify({ type: 'deposit', amount: '1', padding: 'x'.repeat(5000) }), key: key('size') }), 413);
    await rejected({ type: 'deposit', amount: '1' }, 415, { headers: { 'content-type': 'text/plain' } });
    expectStatus(await request('/api/commands', { body: { type: 'deposit', amount: '1' } }), 400);
    await rejected({ type: 'deposit', amount: '1' }, 400, { key: 'short' });
  });

  await check('caller-provided owner, state, randomness, and unsupported actions reject', async () => {
    await rejected({ type: 'deposit', amount: '1', owner: bob.id }, 422);
    await rejected({ type: 'deposit', amount: '1', state: { wallet: '999999999999999' } }, 422);
    await rejected({ type: 'resolve', drawId: 1, randomIndex: '0' }, 422);
    await rejected({ type: 'live_deposit', amount: '1' }, 422);
    await rejected({ type: 'deposit', amount: '-1' }, 422);
    await rejected({ type: 'advance', days: 365 }, 422);
    const account = await readAccount();
    assert.equal(account.version, 0, 'Rejected actions must not increment account version');
    assert.equal(account.state.balance, '0');
    assert.equal(account.state.events.length, 0);
  });

  await check('sequential same-key deposit returns one persistent receipt and one capital change', async () => {
    const commandKey = key('sequential');
    const first = await command(alice, { type: 'deposit', amount: '100' }, commandKey);
    const repeated = await command(alice, { type: 'deposit', amount: '100' }, commandKey);
    assert.deepEqual(repeated.receipt, first.receipt);
    assert.equal(repeated.replayed, true);
    const account = await readAccount();
    assert.equal(account.version, 1);
    assert.equal(account.state.balance, String(100n * UNIT));
    assert.equal(account.state.events.filter(event => event.type === 'deposit').length, 1);
    await rejected({ type: 'deposit', amount: '101' }, 422, { key: commandKey });
    assert.equal((await readAccount()).state.balance, String(100n * UNIT));
  });

  await check('same key is independent for different authenticated owners', async () => {
    const sharedKey = key('owner-scope');
    await command(alice, { type: 'deposit', amount: '2' }, sharedKey);
    await command(bob, { type: 'deposit', amount: '3' }, sharedKey);
    const [a, b] = await Promise.all([readAccount(alice), readAccount(bob)]);
    assert.equal(a.state.balance, String(102n * UNIT));
    assert.equal(b.state.balance, String(3n * UNIT));
    assert.equal(b.version, 1);
    const selected = expectStatus(await request(`/api/account?owner=${encodeURIComponent(alice.id)}`, { user: bob }), 200);
    assert.equal(selected.state.balance, b.state.balance, 'Query parameter must not select another owner');
  });

  await check('concurrent same-key deposits apply exactly once', async () => {
    const before = await readAccount();
    const commandKey = key('concurrent-same');
    const results = await Promise.all(Array.from({ length: 8 }, () => command(alice, { type: 'deposit', amount: '25' }, commandKey)));
    for (const result of results) assert.deepEqual(result.receipt, results[0].receipt);
    const after = await readAccount();
    assert.equal(after.version, before.version + 1);
    assert.equal(BigInt(after.state.balance), BigInt(before.state.balance) + 25n * UNIT);
    assert.equal(after.state.events.length, before.state.events.length + 1);
  });

  await check('concurrent distinct deposits preserve every amount using stable retry keys', async () => {
    const before = await readAccount();
    const deposits = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const jobs = deposits.map(value => ({ amount: value, key: key(`distinct-${value}`) }));
    const results = await Promise.all(jobs.map(job => command(alice, { type: 'deposit', amount: job.amount }, job.key)));
    assert.equal(new Set(results.map(result => result.receipt.version)).size, jobs.length);
    const after = await readAccount();
    assert.equal(after.version, before.version + jobs.length);
    assert.equal(BigInt(after.state.balance), BigInt(before.state.balance) + 36n * UNIT);
    assert.equal(after.state.events.length, before.state.events.length + jobs.length);
    for (const job of jobs) await command(alice, { type: 'deposit', amount: job.amount }, job.key);
    assert.equal((await readAccount()).version, after.version, 'Replays must not mutate state');
    assert.equal((await readAccount(bob)).state.balance, String(3n * UNIT));
  });

  await check('withdrawal replay succeeds even when applying it again would exceed remaining savings', async () => {
    const before = await readAccount();
    assert.equal(before.state.balance, String(163n * UNIT));
    const commandKey = key('withdraw-replay');
    const first = await command(alice, { type: 'withdraw', amount: '160' }, commandKey);
    assert.equal(first.state.balance, String(3n * UNIT));
    const repeated = await command(alice, { type: 'withdraw', amount: '160' }, commandKey);
    assert.deepEqual(repeated.receipt, first.receipt);
    assert.equal(repeated.replayed, true);
    assert.equal(repeated.state.pending, String(160n * UNIT));
    assert.equal(repeated.version, first.version);
    await rejected({ type: 'withdraw', amount: '160' }, 422);
    const completionKey = key('withdraw-complete');
    const completed = await command(alice, { type: 'complete_withdrawal' }, completionKey);
    const replayedCompletion = await command(alice, { type: 'complete_withdrawal' }, completionKey);
    assert.deepEqual(replayedCompletion.receipt, completed.receipt);
    assert.equal(replayedCompletion.state.pending, '0');
    assert.equal(replayedCompletion.state.wallet, String(9_997n * UNIT));
  });

  await check('closed draw snapshot survives withdrawal and changed future stock preference', async () => {
    await command(drawOwner, { type: 'deposit', amount: '10000' });
    let result = await command(drawOwner, { type: 'advance', days: 7 });
    const snapshot = structuredClone(result.state.draws[0]);
    assert.equal(snapshot.status, 'closed');
    assert.equal(snapshot.stock, 'AAPL');
    assert.match(snapshot.snapshot, /^[0-9a-f]{64}$/);
    await rejected({ type: 'settle_prize', drawId: 1 }, 422, { user: drawOwner });
    await rejected({ type: 'claim', drawId: 1 }, 422, { user: drawOwner });
    await command(drawOwner, { type: 'withdraw', amount: '10000' });
    result = await command(drawOwner, { type: 'select_stock', stock: 'MSFT' });
    assert.deepEqual(result.state.draws[0], snapshot);
    assert.equal(result.state.stock, 'MSFT');
    assert.equal(result.state.pending, String(10_000n * UNIT));
  });

  await check('random result cannot reroll and settlement obeys winner ownership', async () => {
    const resolved = await command(drawOwner, { type: 'resolve', drawId: 1 });
    const draw = structuredClone(resolved.state.draws[0]);
    assert.equal(draw.status, 'randomness_ready');
    assert.match(draw.randomIndex, /^\d+$/);
    assert.ok(Number.isInteger(draw.winner) && draw.winner >= 0 && draw.winner <= 4);
    const repeated = await command(drawOwner, { type: 'resolve', drawId: 1 });
    assert.deepEqual(repeated.state.draws[0], draw, 'New command key must not permit a reroll');
    assert.equal(repeated.state.events.length, resolved.state.events.length);
    const bobBefore = await readAccount(bob);
    await rejected({ type: 'claim', drawId: 1 }, 422, { user: bob });
    await rejected({ type: 'claim', drawId: 1, owner: drawOwner.id }, 422, { user: bob });
    assert.deepEqual(await readAccount(bob), bobBefore);
    const settled = await command(drawOwner, { type: 'settle_prize', drawId: 1 });
    assert.equal(settled.state.draws[0].status, draw.winner === 0 ? 'claimable' : 'settled');
    assert.equal(settled.state.draws[0].randomIndex, draw.randomIndex);
    const settledAgain = await command(drawOwner, { type: 'settle_prize', drawId: 1 });
    assert.equal(settledAgain.state.reservedPrizes, settled.state.reservedPrizes);
    assert.equal(settledAgain.state.paidPrizes, settled.state.paidPrizes);
    assert.equal(settledAgain.state.events.length, settled.state.events.length);
    if (draw.winner === 0) {
      const claimed = await command(drawOwner, { type: 'claim', drawId: 1 });
      assert.equal(claimed.state.draws[0].status, 'claimed');
      assert.equal(claimed.state.holdings.AAPL, draw.amount);
      assert.equal(claimed.state.holdings.MSFT, undefined);
      const claimedAgain = await command(drawOwner, { type: 'claim', drawId: 1 });
      assert.deepEqual(claimedAgain.state.holdings, claimed.state.holdings);
      assert.equal(claimedAgain.state.paidPrizes, claimed.state.paidPrizes);
      assert.equal(claimedAgain.state.events.length, claimed.state.events.length);
      console.log('INFO observed user-winner branch; repeated claims verified over HTTP');
    } else {
      await rejected({ type: 'claim', drawId: 1 }, 422, { user: drawOwner });
      assert.deepEqual(settled.state.holdings, {});
      console.log(`INFO observed example-saver ${draw.winner} branch; user-winner claim branch remains covered by deterministic engine tests`);
    }
  });

  console.log(`PASS ${report.length} local integration groups; ${requests} HTTP requests; ${serviceRetries} service retries; ${transportRetries} transport retries. No hosted site was targeted.`);
}

main().catch(error => {
  console.error(`FAIL after ${report.length} groups: ${error.stack || error}`);
  process.exitCode = 1;
});
