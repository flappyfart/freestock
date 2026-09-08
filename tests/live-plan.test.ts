import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Interface, keccak256, toUtf8Bytes, ZeroAddress } from "ethers";
import { amount, address } from "../lib/live/validation.ts";
import {
  accountPlan,
  matchesAccountRuntime,
  PILOT_ROUTER,
  PILOT_STOCKS,
} from "../lib/live/account-plan.ts";
import { VAULT, USDG } from "../lib/live/config.ts";
import artifact from "../contracts/artifacts/FreestockYieldAccount.artifact.json" with { type: "json" };
const owner = "0x0000000000000000000000000000000000001234";

void test("live amount parsing is exact at the micro-USDG and deposit-limit boundaries", () => {
  assert.equal(amount("0.000001"), 1n);
  assert.equal(amount("99.999999"), 99_999_999n);
  assert.equal(amount("100.000000"), 100_000_000n);
  for (const input of ["0", "100.000001", "-1", "1e1", "1.0000001", "Infinity", " 10", {}, null])
    assert.throws(() => amount(input));
});
void test("wallet validation rejects zero, malformed and non-address data", () => {
  assert.equal(address(owner), owner);
  for (const v of [ZeroAddress, "0x123", "user.eth", "", {}, 1234]) assert.throws(() => address(v));
});
void test("setup bytecode encodes only canonical dependencies and the five tested stock routes", () => {
  const plan = accountPlan(owner);
  const iface = new Interface(artifact.abi);
  const args = iface
    .getAbiCoder()
    .decode(iface.deploy.inputs, `0x${plan.transaction.data.slice(artifact.bytecode.length)}`);
  assert.equal(String(args[0]).toLowerCase(), VAULT.toLowerCase());
  assert.equal(String(args[1]).toLowerCase(), USDG.toLowerCase());
  assert.equal(String(args[2]).toLowerCase(), PILOT_ROUTER.toLowerCase());
  assert.deepEqual(
    Array.from(args[3])
      .map(String)
      .map((a) => a.toLowerCase()),
    PILOT_STOCKS.map((s) => s.address.toLowerCase()),
  );
  assert.equal(args[4], 100_000_000n);
  assert.equal(plan.transaction.from, owner);
  assert.equal(plan.transaction.chainId, "0x1237");
  assert.equal(plan.transaction.value, "0x0");
  assert.equal("to" in plan.transaction, false);
  assert.equal(plan.canSubmit, false);
  assert.equal(plan.creationDataHash, keccak256(plan.transaction.data));
});
void test("prepared artifact matches tested Solidity and the archived compiler input", () => {
  const source = readFileSync(
    new URL("../contracts/src/FreestockYieldAccount.sol", import.meta.url),
    "utf8",
  );
  assert.equal(keccak256(toUtf8Bytes(source)), artifact.sourceHash);
  const standard = JSON.parse(
    readFileSync(
      new URL("../contracts/artifacts/account-standard-input.json", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(
    Object.values(standard.sources).some((s) => (s as { content: string }).content === source),
  );
  assert.equal(artifact.settings.viaIR, true);
  assert.equal(artifact.settings.optimizer.runs, 200);
});
void test("creation runtime comparison rejects changed logic, empty and malformed replies", () => {
  assert.equal(matchesAccountRuntime(artifact.deployedBytecode), true);
  assert.equal(matchesAccountRuntime(`0x00${artifact.deployedBytecode.slice(4)}`), false);
  for (const code of [null, "0x", {}, "not code", artifact.deployedBytecode.slice(0, -2)])
    assert.equal(matchesAccountRuntime(code), false);
  const ref = Object.values(artifact.immutableReferences)[0][0];
  const start = 2 + ref.start * 2;
  const changed =
    artifact.deployedBytecode.slice(0, start) +
    "f".repeat(ref.length * 2) +
    artifact.deployedBytecode.slice(start + ref.length * 2);
  assert.equal(matchesAccountRuntime(changed), true);
});
