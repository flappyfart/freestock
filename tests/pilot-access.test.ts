import test from "node:test";
import assert from "node:assert/strict";
import { hasLiveWalletAccess, liveSessionScope, requiresSessionReset } from "../lib/live/pilot-access.ts";

await test("different signed-in profiles can access wallet-approved live actions", () => {
  for (const user of ["user-a", "user-b", "former-participant"])
    assert.equal(hasLiveWalletAccess(user), true);
  for (const user of [null, "", " ", " user-a", "user-a "])
    assert.equal(hasLiveWalletAccess(user), false);
});

await test("session scopes distinguish profiles without returning their identity", async () => {
  const alice = await liveSessionScope("user-a");
  assert.match(alice!, /^[a-f0-9]{64}$/);
  assert.equal(await liveSessionScope("user-a"), alice);
  assert.notEqual(await liveSessionScope("user-b"), alice);
  assert.equal(await liveSessionScope(null), null);
  assert.equal(await liveSessionScope(" "), null);
});

await test("changing sign-ins or signing out resets mounted profile data; initial load does not", () => {
  assert.equal(requiresSessionReset(undefined, "alice"), false);
  assert.equal(requiresSessionReset(undefined, null), false);
  assert.equal(requiresSessionReset("alice", "alice"), false);
  assert.equal(requiresSessionReset(null, null), false);
  assert.equal(requiresSessionReset("alice", "bob"), true);
  assert.equal(requiresSessionReset("alice", null), true);
  assert.equal(requiresSessionReset(null, "alice"), true);
});
