import legacyConfig from '../../contracts/legacy/v1/deployment-config.json' with { type: 'json' };
import { Interface, keccak256, MaxUint256 } from 'ethers';
import artifact from '../../contracts/artifacts/FreestockYieldAccount.artifact.json' with { type: 'json' };
import legacyArtifact from '../../contracts/legacy/v1/FreestockYieldAccount.artifact.json' with { type: 'json' };
import { CHAIN_ID, USDG, VAULT } from './config.ts';
import { ENABLED_STOCKS } from './basket.ts';
import { address } from './validation.ts';

export const PILOT_ROUTER = '0xcaf681a66d020601342297493863e78c959e5cb2';
export const DEPOSIT_LIMIT = MaxUint256;
export const LEGACY_DEPOSIT_LIMIT = 100_000_000n;
export type AccountVersion = 'v1' | 'v2';
// EIP-7702 delegated EOAs can still originate ordinary direct CREATE transactions.
// Contract wallets and malformed delegation markers cannot use this deployment path.
export function canDeployDirectly(code: unknown) {
  return typeof code === 'string' &&
    (code === '0x' || /^0xef0100[0-9a-f]{40}$/i.test(code));
}
// Every enabled stock passed actual swap and onward-transfer checks on a local mainnet fork.
export const PILOT_STOCKS = ENABLED_STOCKS;
export function accountPlan(
  ownerInput: string,
  version: AccountVersion = 'v2',
) {
  const compiled = version === 'v1' ? legacyArtifact : artifact;
  const cap = version === 'v1' ? LEGACY_DEPOSIT_LIMIT : DEPOSIT_LIMIT;
  const owner = address(ownerInput);
  const iface = new Interface(compiled.abi);
  const config =
    version === 'v1'
      ? legacyConfig
      : {
          vault: VAULT,
          asset: USDG,
          router: PILOT_ROUTER,
          stocks: PILOT_STOCKS,
        };
  const args = [
    config.vault,
    config.asset,
    config.router,
    config.stocks.map((s) => s.address),
    cap,
  ];
  const data = compiled.bytecode + iface.encodeDeploy(args).slice(2);
  return {
    mode: 'unsigned-account-plan',
    chainId: CHAIN_ID,
    owner,
    vault: config.vault,
    asset: config.asset,
    router: config.router,
    stocks: config.stocks.map((s) => s.symbol),
    accountVersion: version,
    depositLimit: cap.toString(),
    uncapped: version === 'v2',
    sourceHash: compiled.sourceHash,
    creationDataHash: keccak256(data),
    transaction: { from: owner, data, value: '0x0', chainId: '0x1237' },
    canSubmit: false,
    reason:
      'This read-only setup preview does not deploy. Open Your position in Dashboard to review an actual wallet transaction.',
  };
}

// Solidity embeds constructor-set immutable values at these compiler-reported offsets.
// Check all other bytes against the exact tested compiler output after eth_call creation.
export function matchesAccountRuntime(
  code: unknown,
  version: AccountVersion = 'v2',
) {
  const compiled = version === 'v1' ? legacyArtifact : artifact;
  if (typeof code !== 'string' || !/^0x[\da-f]+$/i.test(code)) return false;
  const expected = compiled.deployedBytecode.toLowerCase();
  if (code.length !== expected.length) return false;
  const normalized = code.toLowerCase().split('');
  for (const refs of Object.values(compiled.immutableReferences)) {
    for (const { start, length } of refs) {
      const offset = 2 + start * 2;
      normalized.splice(
        offset,
        length * 2,
        ...expected.slice(offset, offset + length * 2).split(''),
      );
    }
  }
  return normalized.join('') === expected;
}

export function accountDeploymentVersion(
  owner: string,
  input: unknown,
): AccountVersion | null {
  if (typeof input !== 'string') return null;
  for (const version of ['v2', 'v1'] as const) {
    if (
      input.toLowerCase() ===
      accountPlan(owner, version).transaction.data.toLowerCase()
    )
      return version;
  }
  return null;
}
