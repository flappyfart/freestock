import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import artifact from '../contracts/artifacts/FreestockYieldAccount.artifact.json' with { type: 'json' };
import {
  defaultAgentPlan,
  agentPurchaseAmount,
  evaluateLending,
  planFingerprint,
  validateAgentPlan,
  validateAgentIntent,
  type AgentAccount,
  type AgentPlan,
  type AgentQuote,
  type AgentIntent,
} from '../lib/live/agentic-lending.ts';
import { CHAIN_ID, VAULT } from '../lib/live/config.ts';
import { ENABLED_STOCKS } from '../lib/live/basket.ts';
const now = Date.parse('2026-09-09T05:00:00Z'),
  owner = `0x${'1'.repeat(40)}`,
  accountAddress = `0x${'2'.repeat(40)}`,
  deployment = `0x${'3'.repeat(64)}`;
const iso = (delta = 0) => new Date(now + delta).toISOString();
function account(extra: Partial<AgentAccount> = {}): AgentAccount {
  return {
    owner,
    account: accountAddress,
    deployment,
    chainId: CHAIN_ID,
    vault: VAULT,
    principal: '10000000',
    assetValue: '12000002',
    availableGains: '2000002',
    spendableWithRoundingBuffer: '2000000',
    block: 10,
    blockTime: iso(),
    observedAt: iso(),
    ...extra,
  };
}
function quote(plan = defaultAgentPlan, amount = '2000000'): AgentQuote {
  const iface = new Interface(artifact.abi),
    stock = ENABLED_STOCKS.find((s) => s.symbol === 'NVDA')!;
  return {
    fingerprint: planFingerprint(plan),
    prepared: {
      action: 'harvest',
      deployment,
      owner,
      account: accountAddress,
      assets: amount,
      summary: 'Test quote',
      minimumOut: null,
      tokenOut: null,
      purchases: [
        {
          symbol: 'NVDA',
          tokenOut: stock.address,
          amountIn: amount,
          amountOut: '10000',
          minimumOut: '9900',
          fee: 500,
          weightBps: 10000,
          observedAt: iso(),
          expiresAt: iso(60000),
        },
      ],
      simulation: 'passed',
      estimatedGasCostWei: plan.maximumGasWei,
      hasGasBalance: true,
      canSubmit: true,
      expiresAt: iso(45000),
      transaction: {
        from: owner,
        to: accountAddress,
        data: iface.encodeFunctionData('harvest', [
          [stock.address],
          [500],
          [BigInt(amount)],
          [9900],
          0,
          Math.floor(now / 1000) + 100,
        ]),
        value: '0x0',
        chainId: '0x1237',
        gas: '0x10000',
        nonce: '0x0',
      },
    },
  };
}
const check = (
  a: AgentAccount | null,
  plan: AgentPlan = defaultAgentPlan,
  q?: AgentQuote,
) => evaluateLending({ owner, account: a, plan, quote: q, now });
void test('an empty account asks the owner to fund a position for either destination', () => {
  const empty = account({
    principal: '0',
    assetValue: '0',
    availableGains: '0',
    spendableWithRoundingBuffer: '0',
  });
  for (const destination of ['stocks', 'retain'] as const) {
    const result = check(empty, { ...defaultAgentPlan, destination });
    assert.equal(result.code, 'setup');
    assert.equal(result.canQuote, false);
  }
});
void test('quotes preserve their exact spending amount as surplus changes', () => {
  const q = quote();
  assert.equal(
    check(
      account({
        assetValue: '13000002',
        availableGains: '3000002',
        spendableWithRoundingBuffer: '3000000',
      }),
      defaultAgentPlan,
      q,
    ).code,
    'review',
  );
  assert.equal(
    check(account(), defaultAgentPlan, quote(defaultAgentPlan, '1500000')).code,
    'review',
  );
  assert.equal(
    check(
      account({
        assetValue: '11999999',
        availableGains: '1999999',
        spendableWithRoundingBuffer: '1999997',
      }),
      defaultAgentPlan,
      q,
    ).code,
    'quote',
  );
  assert.equal(
    check(account(), defaultAgentPlan, quote(defaultAgentPlan, '1000000')).code,
    'review',
  );
  assert.equal(
    check(account(), defaultAgentPlan, quote(defaultAgentPlan, '999999')).code,
    'quote',
  );
});
void test('quote requests and recommendations use the full available surplus above 100 USDG', () => {
  const large = account({
    assetValue: '210000002',
    availableGains: '200000002',
    spendableWithRoundingBuffer: '200000000',
  });
  assert.equal(agentPurchaseAmount(large), 200_000_000n);
  assert.equal(
    check(large, defaultAgentPlan, quote(defaultAgentPlan, '200000000')).code,
    'review',
  );
  assert.equal(
    check(large, defaultAgentPlan, quote(defaultAgentPlan, '200000001')).code,
    'quote',
  );
});
void test('minimum boundary uses spendable surplus after reserve, never wallet holdings', () => {
  const a = account({
    assetValue: '11000002',
    availableGains: '1000002',
    spendableWithRoundingBuffer: '1000000',
  });
  assert.equal(check(a).code, 'quote');
  assert.equal(
    check(
      account({
        assetValue: '11000001',
        availableGains: '1000001',
        spendableWithRoundingBuffer: '999999',
      }),
    ).code,
    'accumulate',
  );
  for (const gain of [0, 1, 2])
    assert.equal(
      check(
        account({
          assetValue: String(10000000 + gain),
          availableGains: String(gain),
          spendableWithRoundingBuffer: '0',
        }),
      ).code,
      'accumulate',
    );
});
void test('losses recover first and retention requires no transaction or quote', () => {
  assert.equal(
    check(
      account({
        assetValue: '9000000',
        availableGains: '0',
        spendableWithRoundingBuffer: '0',
      }),
    ).code,
    'loss',
  );
  const d = check(account(), { ...defaultAgentPlan, destination: 'retain' });
  assert.equal(d.code, 'hold');
  assert.equal(d.canQuote, false);
  assert.equal(d.canReview, false);
});
void test('stale chain head, future data, mismatched owner and inconsistent accounting cannot qualify', () => {
  for (const changed of [
    { blockTime: iso(-46000) },
    { observedAt: iso(-46000) },
    { blockTime: iso(6000) },
    { owner: accountAddress },
    { chainId: 1 },
    { vault: accountAddress },
    { spendableWithRoundingBuffer: '2000002' },
  ])
    assert.equal(check(account(changed)).code, 'stale');
  assert.equal(check(null).code, 'setup');
  assert.equal(
    evaluateLending({
      owner,
      account: account(),
      plan: defaultAgentPlan,
      now,
      readError: 'RPC failed',
    }).code,
    'stale',
  );
});
void test('pause and pending actions prevent actionable advice', () => {
  assert.equal(
    check(account(), { ...defaultAgentPlan, paused: true }, quote()).code,
    'paused',
  );
  const d = evaluateLending({
    owner,
    account: account(),
    plan: defaultAgentPlan,
    quote: quote(),
    now,
    blocked: true,
  });
  assert.equal(d.code, 'busy');
  assert.equal(d.canReview, false);
});
void test('cost at ETH limit qualifies for review, above limit waits; no USDG conversion is inferred', () => {
  const q = quote();
  assert.equal(check(account(), defaultAgentPlan, q).code, 'review');
  q.prepared.estimatedGasCostWei = (
    BigInt(defaultAgentPlan.maximumGasWei) + 1n
  ).toString();
  assert.equal(check(account(), defaultAgentPlan, q).code, 'gas');
  q.prepared.hasGasBalance = false;
  assert.equal(check(account(), defaultAgentPlan, q).canReview, false);
});
void test('expired basket leg, altered fee, allocation or balance requires a fresh check', () => {
  for (const alter of [
    (q: AgentQuote) => {
      q.prepared.purchases![0].expiresAt = iso(-1);
    },
    (q: AgentQuote) => {
      q.prepared.purchases![0].observedAt = iso(-46000);
    },
    (q: AgentQuote) => {
      q.prepared.purchases![0].fee = 3000;
    },
    (q: AgentQuote) => {
      q.prepared.purchases![0].weightBps = 5000;
    },
    (q: AgentQuote) => {
      q.prepared.expiresAt = iso(-1);
    },
    (q: AgentQuote) => {
      q.prepared.assets = '2000001';
    },
    (q: AgentQuote) => {
      q.fingerprint = 'different plan';
    },
  ]) {
    const q = quote();
    alter(q);
    assert.equal(check(account(), defaultAgentPlan, q).code, 'quote');
  }
});
void test('invalid weights, unsupported stocks and malformed persisted settings are rejected', () => {
  for (const allocations of [
    [{ symbol: 'MSFT', weightBps: 10000 }],
    [{ symbol: 'NVDA', weightBps: 9999 }],
    [
      { symbol: 'NVDA', weightBps: 5000 },
      { symbol: 'NVDA', weightBps: 5000 },
    ],
    [],
  ])
    assert.throws(() =>
      validateAgentPlan({ ...defaultAgentPlan, allocations }),
    );
  assert.throws(() =>
    validateAgentPlan({ ...defaultAgentPlan, maximumGasWei: '-1' }),
  );
  assert.throws(() =>
    validateAgentPlan({ ...defaultAgentPlan, minimumGains: '0' }),
  );
});
void test('manual handoff binds provider scope, wallet, account, deployment, amount and expiry', () => {
  const intent: AgentIntent = {
    id: 'test',
    scope: 'provider:wallet:4663',
    owner,
    account: accountAddress,
    deployment,
    amount: '2000000',
    allocations: defaultAgentPlan.allocations,
    expiresAt: iso(45000),
  };
  validateAgentIntent(intent, intent.scope, account(), owner, now);
  for (const changes of [
    { scope: 'different provider' },
    { owner: accountAddress },
    { account: owner },
    { deployment: `0x${'4'.repeat(64)}` },
    { amount: '2000001' },
    { expiresAt: iso(-1) },
  ])
    assert.throws(() =>
      validateAgentIntent(
        { ...intent, ...changes },
        intent.scope,
        account(),
        owner,
        now,
      ),
    );
});
