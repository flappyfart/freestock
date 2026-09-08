import { Interface, keccak256 } from "ethers";
import artifact from "../../contracts/artifacts/FreestockYieldAccount.artifact.json" with { type: "json" };
import { CHAIN_ID, USDG, VAULT } from "./config.ts";
import { ENABLED_STOCKS } from "./basket.ts";
import { address } from "./validation.ts";

export const PILOT_ROUTER = "0xcaf681a66d020601342297493863e78c959e5cb2";
export const DEPOSIT_LIMIT = 100_000_000n;
// Every enabled stock passed actual swap and onward-transfer checks on a local mainnet fork.
export const PILOT_STOCKS = ENABLED_STOCKS;
export function accountPlan(ownerInput: string) {
  const owner = address(ownerInput);
  const iface = new Interface(artifact.abi);
  const args = [VAULT, USDG, PILOT_ROUTER, PILOT_STOCKS.map((s) => s.address), DEPOSIT_LIMIT];
  const data = artifact.bytecode + iface.encodeDeploy(args).slice(2);
  return {
    mode: "unsigned-account-plan",
    chainId: CHAIN_ID,
    owner,
    vault: VAULT,
    asset: USDG,
    router: PILOT_ROUTER,
    stocks: PILOT_STOCKS.map((s) => s.symbol),
    depositLimit: DEPOSIT_LIMIT.toString(),
    sourceHash: artifact.sourceHash,
    creationDataHash: keccak256(data),
    transaction: { from: owner, data, value: "0x0", chainId: "0x1237" },
    canSubmit: false,
    reason:
      "This read-only setup preview does not deploy. Use the private wallet pilot to review an actual wallet transaction.",
  };
}

// Solidity embeds constructor-set immutable values at these compiler-reported offsets.
// Check all other bytes against the exact tested compiler output after eth_call creation.
export function matchesAccountRuntime(code: unknown) {
  if (typeof code !== "string" || !/^0x[\da-f]+$/i.test(code)) return false;
  const expected = artifact.deployedBytecode.toLowerCase();
  if (code.length !== expected.length) return false;
  const normalized = code.toLowerCase().split("");
  for (const refs of Object.values(artifact.immutableReferences)) {
    for (const { start, length } of refs) {
      const offset = 2 + start * 2;
      normalized.splice(
        offset,
        length * 2,
        ...expected.slice(offset, offset + length * 2).split(""),
      );
    }
  }
  return normalized.join("") === expected;
}
