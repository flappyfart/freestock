#!/usr/bin/env node
/**
 * Freestock read-only integration probe. Node >= 20 and curl; no npm dependencies.
 * Default: replay recorded block numbers. --latest pins fresh block numbers first.
 * node work/verify-integrations.mjs --out work/integration-probe.json
 * node work/verify-integrations.mjs --latest --out work/integration-probe-latest.json
 * node work/verify-integrations.mjs --self-test
 * Only public RPC reads are supported. This cannot establish deposit/settlement readiness.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const CONFIG = Object.freeze({
  robinhood: { url: 'https://rpc.mainnet.chain.robinhood.com', chainId: 4663, block: '0x3742b76', router: '0x06fC836cf9839B1cd891C440A0a45242DA6Ae1c9', selector: '6180753054346818345' },
  arbitrum: { url: 'https://arb1.arbitrum.io/rpc', chainId: 42161, block: '0x1dfd122b', router: '0x141fa059441E0ca23ce184B6A78bafD2A517DdE8', selector: '4949039107694359620' },
  vault: '0xBeEff033F34C046626B8D0A041844C5d1A5409dd',
  usdg: '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168',
  recordedVaultCodeHash: '0x3492098028b641c5949beebf8c56898f1ed846f42b59978ed7c75249603c1f6e',
});
const execFileAsync = promisify(execFile);
// Use the same HTTP client that produced the original public-RPC evidence.
export async function curlTransport(url, options) {
  const { stdout } = await execFileAsync('curl', ['--silent', '--show-error', '--max-time', '25', '--write-out', '\n%{http_code}', '--header', 'Content-Type: application/json', '--data-binary', options.body, url], { timeout: 30_000, maxBuffer: 2_000_000 });
  const boundary = stdout.lastIndexOf('\n');
  const status = Number(stdout.slice(boundary + 1));
  return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(stdout.slice(0, boundary)) };
}
const READ_METHODS = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber', 'eth_call', 'eth_getCode', 'web3_sha3']);
const ZERO = `0x${'0'.repeat(40)}`;
const WORD = /^0x[0-9a-fA-F]{64}$/;
export function uint64Word(value) {
  const n = BigInt(value);
  if (n < 0n || n >= 2n ** 64n) throw new Error('Value exceeds uint64');
  return n.toString(16).padStart(64, '0');
}
export function decodeWord(hex, kind = 'uint') {
  if (!WORD.test(hex)) throw new Error(`Invalid ABI word for ${kind}`);
  if (kind === 'address') return `0x${hex.slice(-40)}`.toLowerCase();
  const n = BigInt(hex);
  if (kind === 'bool') {
    if (n !== 0n && n !== 1n) throw new Error('Invalid ABI boolean');
    return n === 1n;
  }
  return n.toString();
}
export function createRpc(url, evidence = [], transport = curlTransport) {
  let id = 0;
  return async (method, params = []) => {
    if (!READ_METHODS.has(method)) throw new Error(`Read-only probe rejects RPC method: ${method}`);
    const request = { jsonrpc: '2.0', id: ++id, method, params };
    const response = await transport(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(25_000) });
    if (!response.ok) throw new Error(`RPC ${method} at ${new URL(url).hostname}: HTTP ${response.status}`);
    const body = await response.json();
    // Code bytes are fingerprinted separately; preserve the exact result for every other read.
    evidence.push({ rpc: url, request, response: method === 'eth_getCode' && body.result ? { ...body, result: `[${(body.result.length - 2) / 2} byte runtime; hash recorded separately]` } : body });
    if (body.error) throw new Error(`${method}: ${body.error.message ?? JSON.stringify(body.error)}`);
    if (body.id !== request.id || !Object.hasOwn(body, 'result')) throw new Error('Invalid RPC response identity/result');
    return body.result;
  };
}

export async function probe({ latest = false, transport = curlTransport } = {}) {
  const report = { generatedAt: new Date().toISOString(), readOnly: true, activationReady: false, mode: latest ? 'fresh-blocks' : 'recorded-blocks', limits: ['No deposit/redeem, signing, transaction submission, fee quote, CCIP delivery, or stock acquisition is performed.', 'Successful observations do not prove production readiness.'], blocks: {}, observations: {}, checks: {}, requests: [] };
  const rh = createRpc(CONFIG.robinhood.url, report.requests, transport);
  const ar = createRpc(CONFIG.arbitrum.url, report.requests, transport);
  for (const [name, client] of [['robinhood', rh], ['arbitrum', ar]]) {
    const cfg = CONFIG[name];
    const chainId = Number(BigInt(await client('eth_chainId')));
    if (chainId !== cfg.chainId) throw new Error(`${String(name)}: wrong chain ID ${chainId}`);
    const block = latest ? await client('eth_blockNumber') : cfg.block;
    const info = await client('eth_getBlockByNumber', [block, false]);
    if (!info || BigInt(info.number) !== BigInt(block)) throw new Error(`${String(name)}: pinned block unavailable`);
    report.blocks[name] = { number: BigInt(block).toString(), hex: block, hash: info.hash, timestamp: new Date(Number(BigInt(info.timestamp)) * 1000).toISOString(), chainId };
  }
  const selectors = new Map();
  async function selector(signature) {
    if (!selectors.has(signature)) {
      const hash = await rh('web3_sha3', [`0x${Buffer.from(signature).toString('hex')}`]);
      if (!WORD.test(hash)) throw new Error('RPC returned invalid keccak256');
      selectors.set(signature, hash.slice(0, 10));
    }
    return selectors.get(signature);
  }
  async function read(client, block, to, signature, kind, args = '') {
    return decodeWord(await client('eth_call', [{ to, data: (await selector(signature)) + args }, block]), kind);
  }
  const block = report.blocks.robinhood.hex;
  const vault = { address: CONFIG.vault, gates: {} };
  for (const [signature, kind] of [['asset()', 'address'], ['decimals()', 'uint'], ['owner()', 'address'], ['curator()', 'address'], ['liquidityAdapter()', 'address'], ['totalAssets()', 'uint'], ['totalSupply()', 'uint']]) {
    vault[signature.slice(0, -2)] = await read(rh, block, CONFIG.vault, signature, kind);
  }
  for (const name of ['sendAssetsGate', 'receiveSharesGate', 'sendSharesGate', 'receiveAssetsGate']) {
    const setter = `set${name[0].toUpperCase()}${name.slice(1)}(address)`;
    const setterWord = (await selector(setter)).slice(2).padEnd(64, '0');
    vault.gates[name] = {
      address: await read(rh, block, CONFIG.vault, `${name}()`, 'address'),
      setterAbdicated: await read(rh, block, CONFIG.vault, 'abdicated(bytes4)', 'bool', setterWord),
      setterTimelockSeconds: await read(rh, block, CONFIG.vault, 'timelock(bytes4)', 'uint', setterWord),
    };
  }
  const code = await rh('eth_getCode', [CONFIG.vault, block]);
  if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(code)) throw new Error('Vault has no valid deployed runtime code');
  vault.runtimeByteLength = (code.length - 2) / 2;
  vault.runtimeCodeHash = await rh('web3_sha3', [code]);
  report.observations.vault = vault;
  report.observations.usdg = { address: CONFIG.usdg, decimals: await read(rh, block, CONFIG.usdg, 'decimals()', 'uint') };
  report.observations.ccip = {
    robinhoodToArbitrum: await read(rh, block, CONFIG.robinhood.router, 'isChainSupported(uint64)', 'bool', uint64Word(CONFIG.arbitrum.selector)),
    arbitrumToRobinhood: await read(ar, report.blocks.arbitrum.hex, CONFIG.arbitrum.router, 'isChainSupported(uint64)', 'bool', uint64Word(CONFIG.robinhood.selector)),
  };
  report.checks = {
    canonicalVaultAsset: vault.asset === CONFIG.usdg.toLowerCase(),
    usdgSixDecimals: report.observations.usdg.decimals === '6',
    recordedVaultBytecodeMatches: vault.runtimeCodeHash === CONFIG.recordedVaultCodeHash,
    allFourGatesCurrentlyUnset: Object.values(vault.gates).every(gate => gate.address === ZERO),
    robinhoodRouterSupportsArbitrum: report.observations.ccip.robinhoodToArbitrum,
    arbitrumRouterSupportsRobinhood: report.observations.ccip.arbitrumToRobinhood,
  };
  return report;
}

export async function selfTest() {
  assert.equal(uint64Word('6180753054346818345').length, 64);
  assert.throws(() => uint64Word(2n ** 64n), /exceeds/);
  assert.throws(() => uint64Word(-1), /exceeds/);
  assert.equal(decodeWord(`0x${'0'.repeat(63)}1`, 'bool'), true);
  assert.throws(() => decodeWord(`0x${'0'.repeat(63)}2`, 'bool'), /boolean/);
  assert.throws(() => decodeWord('0x'), /Invalid ABI/);
  let called = false;
  const client = createRpc('https://unused.invalid', [], async () => { called = true; return { ok: true, json: async () => ({ id: 1, result: '0x1237' }) }; });
  await assert.rejects(client('eth_sendRawTransaction', ['0x']), /Read-only/);
  await assert.rejects(client('eth_sign', []), /Read-only/);
  assert.equal(called, false, 'write methods must be rejected before transport');
  const wrongId = createRpc('https://unused.invalid', [], async () => ({ ok: true, json: async () => ({ id: 999, result: '0x1' }) }));
  await assert.rejects(wrongId('eth_chainId'), /identity/);
  console.log('PASS: read-only guard, uint64 bounds, ABI validation, and response identity. No network used.');
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--self-test')) await selfTest();
    else if (args.includes('--help')) console.log('Usage: node verify-integrations.mjs [--latest] [--out FILE] | --self-test\nDefaults to recorded Robinhood 57944950 and Arbitrum 503124523 blocks. No writes/signing.');
    else {
      const unknown = args.filter((value, index) => !['--latest', '--out'].includes(value) && args[index - 1] !== '--out');
      if (unknown.length) throw new Error(`Unknown arguments: ${unknown.join(' ')}`);
      const outIndex = args.indexOf('--out');
      if (outIndex >= 0 && (!args[outIndex + 1] || args[outIndex + 1].startsWith('--'))) throw new Error('--out requires a file path');
      const output = outIndex >= 0 ? args[outIndex + 1] : 'work/integration-probe.json';
      const report = await probe({ latest: args.includes('--latest') });
      await mkdir(dirname(resolve(output)), { recursive: true });
      await writeFile(output, JSON.stringify(report, null, 2) + '\n');
      console.log(JSON.stringify({ output: resolve(output), blocks: report.blocks, checks: report.checks, activationReady: false }, null, 2));
      if (Object.values(report.checks).some(value => !value)) process.exitCode = 2;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
