import test from "node:test";
import assert from "node:assert/strict";
import { hasPrivatePilotAccess } from "../lib/live/pilot-access.ts";

await test("private pilot allows only the configured signed-in account", () => {
  assert.equal(hasPrivatePilotAccess("participant-1", "participant-1"), true);
  for (const user of [null, "", "participant-2", " participant-1", "PARTICIPANT-1"])
    assert.equal(hasPrivatePilotAccess(user, "participant-1"), false);
});

await test("missing or blank pilot configuration never grants new funded actions", () => {
  for (const configured of [undefined, "", " "])
    for (const user of [null, "", " ", "participant-1"])
      assert.equal(hasPrivatePilotAccess(user, configured), false);
});
