import test from "node:test";
import assert from "node:assert/strict";
import { COUNTRIES } from "../lib/countries.ts";
import { assessAvailability, LAUNCH_POLICY } from "../lib/launch-policy.ts";

const complete = { residence: "DE", location: "DE", usPerson: "no" };

await test("US residence, physical presence and US-person status each independently exclude", () => {
  for (const input of [
    { ...complete, residence: "US" },
    { ...complete, location: "US" },
    { ...complete, usPerson: "yes" },
    { usPerson: "yes" },
  ])
    assert.equal(assessAvailability(input).status, "unavailable");
});

await test("US territories are excluded for residence and current location", () => {
  for (const code of ["AS", "GU", "MP", "PR", "UM", "VI"]) {
    assert.equal(assessAvailability({ ...complete, residence: code }).status, "unavailable");
    assert.equal(assessAvailability({ ...complete, location: code }).status, "unavailable");
  }
});

await test("issuer residence exclusions and prohibited jurisdictions are respected", () => {
  for (const code of [
    "CA",
    "GB",
    "CH",
    "CU",
    "BY",
    "IR",
    "KP",
    "RU",
    "SY",
    "UA",
    "SS",
    "SD",
    "MM",
    "VE",
  ]) {
    assert.equal(assessAvailability({ ...complete, residence: code }).status, "unavailable");
  }
  for (const code of ["CU", "BY", "IR", "KP", "RU", "SY", "UA", "SS", "SD", "MM", "VE"]) {
    assert.equal(assessAvailability({ ...complete, location: code }).status, "unavailable");
  }
});

await test("missing, malformed and uncertain inputs never imply eligibility", () => {
  for (const input of [
    {},
    { ...complete, residence: "ZZ" },
    { ...complete, location: null },
    { ...complete, usPerson: "unsure" },
    { ...complete, usPerson: false },
    { ...complete, residence: { country: "DE" } },
  ]) {
    assert.equal(assessAvailability(input).status, "needs_information");
  }
});

await test("other countries remain pending, including normalized country input", () => {
  assert.equal(assessAvailability(complete).status, "pending");
  assert.equal(assessAvailability({ ...complete, residence: " de " }).status, "pending");
});

await test("no country or answer can enable funds or trading in prelaunch", () => {
  assert.equal(COUNTRIES.length, 249);
  assert.equal(new Set(COUNTRIES.map(([code]) => code)).size, 249);
  assert.equal(LAUNCH_POLICY.approvedCountries.length, 0);
  assert.equal(LAUNCH_POLICY.realDepositsEnabled, false);
  assert.equal(LAUNCH_POLICY.realTradingEnabled, false);
  for (const [code] of COUNTRIES) {
    for (const usPerson of ["yes", "no", "unsure", "", null]) {
      const result = assessAvailability({ residence: code, location: code, usPerson });
      assert.equal(result.realDepositsEnabled, false);
      assert.equal(result.realTradingEnabled, false);
      assert.ok(["unavailable", "pending", "needs_information"].includes(result.status));
    }
  }
});
