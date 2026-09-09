import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWalletRequestGate,
  dashboardRecoveryPath,
  mergeDiscoveredWallet,
  parseWalletIdentity,
  readWalletIdentity,
  type DiscoveredWallet,
} from "../app/live/wallet-connection.ts";
const owner = `0x${"12".repeat(20)}`;
function wallet(uuid: string): DiscoveredWallet {
  return {
    info: { uuid, name: uuid, rdns: `wallet.${uuid}` },
    provider: { request: () => Promise.resolve(null) },
  };
}
void test("discovery replaces fallback metadata without duplicating the same provider", () => {
  const actual = wallet("a");
  const fallback = {
    ...actual,
    info: { uuid: "injected", name: "Browser wallet", rdns: "injected" },
  };
  const result = mergeDiscoveredWallet([fallback], actual);
  assert.deepEqual(result, [actual]);
  assert.equal(mergeDiscoveredWallet(result, fallback), result);
});
void test("multiple installed wallets remain distinct and repeated announcements are stable", () => {
  const a = wallet("a"),
    b = wallet("b");
  const result = mergeDiscoveredWallet([a], b);
  assert.deepEqual(result, [a, b]);
  assert.equal(mergeDiscoveredWallet(result, a), result);
});
void test("malformed discovery does not add an unusable wallet", () => {
  const list = [wallet("a")];
  assert.equal(
    mergeDiscoveredWallet(list, { ...wallet("broken"), info: { uuid: "", name: "", rdns: "" } }),
    list,
  );
});
void test("valid wallet identity retains the actual account and network", () => {
  assert.deepEqual(parseWalletIdentity([owner], "0x1237"), { owner, network: 4663 });
  assert.deepEqual(parseWalletIdentity([owner], "0x1"), { owner, network: 1 });
});
void test("missing accounts and malformed chain identities are rejected", () => {
  for (const [accounts, chain] of [
    [[], "0x1237"],
    [["0x123"], "0x1237"],
    [[owner], "4663"],
    [[owner], "0xffffffffffffffffff"],
  ])
    assert.throws(() => parseWalletIdentity(accounts, chain));
});
void test("identity refresh is read-only and never requests wallet permission or a signature", async () => {
  const methods: string[] = [];
  const identity = await readWalletIdentity({
    request: ({ method }) => {
      methods.push(method);
      return Promise.resolve(method === "eth_accounts" ? [owner] : "0x1237");
    },
  });
  assert.deepEqual(identity, { owner, network: 4663 });
  assert.deepEqual(methods, ["eth_accounts", "eth_chainId"]);
});
void test("the connection gate prevents overlapping requests and releases after completion", async () => {
  const gate = createWalletRequestGate();
  let release!: () => void;
  let prompts = 0;
  const first = gate.run(async () => {
    prompts++;
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    return "connected";
  });
  assert.equal(gate.isBusy(), true);
  assert.equal(
    await gate.run(() => {
      prompts++;
      return Promise.resolve("duplicate");
    }),
    undefined,
  );
  assert.equal(prompts, 1);
  release();
  assert.equal(await first, "connected");
  assert.equal(gate.isBusy(), false);
});
void test("a rejected request releases the gate for a later explicit retry", async () => {
  const gate = createWalletRequestGate();
  await assert.rejects(gate.run(() => Promise.reject(Error("Wallet rejected"))));
  assert.equal(await gate.run(() => Promise.resolve("retry")), "retry");
});
void test("legacy wallet URLs preserve deployment, transaction, extra query and hash on dashboard", () => {
  assert.equal(
    dashboardRecoveryPath("?deployment=0xabc&transaction=0xdef&view=old", "#wallet-connection"),
    "/dashboard?deployment=0xabc&transaction=0xdef&view=old#wallet-connection",
  );
  assert.equal(dashboardRecoveryPath(""), "/dashboard");
});
