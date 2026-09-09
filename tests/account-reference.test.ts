import assert from "node:assert/strict";
import { test } from "node:test";
import {
  readAccountReference,
  saveAccountReference,
  forgetAccountReference,
  accountRestoreCandidate,
  rejectedUrlAccountFallback,
} from "../lib/live/account-reference.ts";
const owner = `0x${"a1".repeat(20)}`;
const other = `0x${"b2".repeat(20)}`;
const deployment = `0x${"12".repeat(32)}`;
const successor = `0x${"34".repeat(32)}`;
function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
void test("account references store only the deployment hash, scoped to chain and normalized owner", () => {
  const store = storage();
  assert.equal(saveAccountReference(owner, deployment, store), null);
  assert.deepEqual([...store.values], [[`freestock:account-reference:4663:${owner}`, deployment]]);
  assert.equal(
    readAccountReference(owner.toUpperCase().replace("0X", "0x"), store).deployment,
    deployment,
  );
  assert.equal(readAccountReference(other, store).deployment, null);
});
void test("malformed saved values are never returned as usable references", () => {
  const store = storage();
  store.setItem(
    `freestock:account-reference:4663:${owner}`,
    JSON.stringify({ balance: "100", deployment }),
  );
  const result = readAccountReference(owner, store);
  assert.equal(result.deployment, null);
  assert.ok(result.warning);
  assert.ok(saveAccountReference(owner, "0x123", store));
});
void test("storage denial produces warnings rather than throwing into account recovery", () => {
  const denied = {
    getItem() {
      throw Error("Storage denied");
    },
    setItem() {
      throw Error("Storage denied");
    },
    removeItem() {
      throw Error("Storage denied");
    },
  };
  assert.equal(readAccountReference(owner, denied).deployment, null);
  assert.ok(readAccountReference(owner, denied).warning);
  assert.ok(saveAccountReference(owner, deployment, denied));
  assert.doesNotThrow(() => forgetAccountReference(owner, deployment, denied));
});
void test("a stale verification failure cannot remove a newer saved reference", () => {
  const store = storage();
  saveAccountReference(owner, successor, store);
  forgetAccountReference(owner, deployment, store);
  assert.equal(readAccountReference(owner, store).deployment, successor);
  forgetAccountReference(owner, successor, store);
  assert.equal(readAccountReference(owner, store).deployment, null);
});

void test("switching from wallet A's URL to wallet B restores B only after definitive URL rejection", async () => {
  const store = storage();
  saveAccountReference(owner, deployment, store);
  saveAccountReference(other, successor, store);
  const initial = accountRestoreCandidate(
    null,
    deployment,
    readAccountReference(other, store).deployment,
  )!;
  const checked: string[] = [];
  const verifyForWalletB = (hash: string) => {
    checked.push(hash);
    if (hash === deployment)
      return Promise.reject(Object.assign(Error("Owner mismatch"), { status: 422 }));
    return Promise.resolve({ owner: other, deployment: hash });
  };
  const verified = await verifyForWalletB(initial.deployment).catch((error: { status: number }) => {
    const fallback = rejectedUrlAccountFallback(other, initial, error.status, false, store);
    assert.equal(fallback?.source, "saved");
    assert.equal(fallback?.deployment, successor);
    return verifyForWalletB(fallback!.deployment);
  });
  assert.deepEqual(checked, [deployment, successor]);
  assert.deepEqual(verified, { owner: other, deployment: successor });
  assert.equal(readAccountReference(owner, store).deployment, deployment);
  assert.equal(readAccountReference(other, store).deployment, successor);
});
void test("account fallback never bypasses uncertain reads, pending requests, or journal precedence", () => {
  const store = storage();
  saveAccountReference(other, successor, store);
  const initial = accountRestoreCandidate(null, deployment, successor)!;
  for (const status of [undefined, 401, 403, 409, 500, 503])
    assert.equal(rejectedUrlAccountFallback(other, initial, status, false, store), null);
  assert.equal(rejectedUrlAccountFallback(other, initial, 422, true, store), null);
  const journalCandidate = accountRestoreCandidate(deployment, successor, successor)!;
  assert.equal(journalCandidate.source, "journal");
  assert.equal(rejectedUrlAccountFallback(other, journalCandidate, 422, false, store), null);
  assert.equal(
    rejectedUrlAccountFallback(other, { deployment: successor, source: "url" }, 422, false, store),
    null,
  );
});
