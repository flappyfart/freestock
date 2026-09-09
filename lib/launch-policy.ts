import { COUNTRIES } from "./countries.ts";

// Retired questionnaire metadata, preserved for legacy simulation compatibility.
// Live wallet authorization is defined in live/pilot-policy.ts.
export const LAUNCH_POLICY = Object.freeze({
  audience: "eligible-non-us-users",
  payoutAsset: "robinhood-stock-tokens",
  phase: "prelaunch",
  realDepositsEnabled: false,
  realTradingEnabled: false,
  approvedCountries: [] as readonly string[],
  sourceCheckedAt: "2026-09-08",
} as const);

export const ISSUER_SOURCES = Object.freeze({
  overview: "https://docs.robinhood.com/chain/stock-tokens/",
  faq: "https://docs.robinhood.com/rhj/faq/",
  restrictions: "https://docs.robinhood.com/rhj/restricted-jurisdictions/",
  usPerson: "https://www.ecfr.gov/current/title-17/chapter-II/part-230/section-230.902",
});

const countryCodes = new Set<string>(COUNTRIES.map(([code]) => code));
const usRegions = new Set(["US", "AS", "GU", "MP", "PR", "UM", "VI"]);
const residenceExclusions = new Set(["CA", "GB", "CH"]);
const prohibitedJurisdictions = new Set([
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
]);

export type AvailabilityInput = {
  residence?: unknown;
  location?: unknown;
  usPerson?: unknown;
};

export type AvailabilityResult = {
  status: "unavailable" | "needs_information" | "pending";
  title: string;
  message: string;
  realDepositsEnabled: false;
  realTradingEnabled: false;
};

function country(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return countryCodes.has(code) ? code : null;
}

export function assessAvailability(input: AvailabilityInput): AvailabilityResult {
  const residence = country(input.residence);
  const location = country(input.location);
  const result = (
    status: AvailabilityResult["status"],
    title: string,
    message: string,
  ): AvailabilityResult => ({
    status,
    title,
    message,
    realDepositsEnabled: false,
    realTradingEnabled: false,
  });

  if (
    input.usPerson === "yes" ||
    (residence && usRegions.has(residence)) ||
    (location && usRegions.has(location))
  ) {
    return result(
      "unavailable",
      "The planned launch is unavailable to you.",
      "freestock is planning a non-US launch. Robinhood Stock Tokens cannot be offered or delivered in the US, to US persons, or for their account or benefit. US territories are included.",
    );
  }
  if (
    (residence && (residenceExclusions.has(residence) || prohibitedJurisdictions.has(residence))) ||
    (location && prohibitedJurisdictions.has(location))
  ) {
    return result(
      "unavailable",
      "The planned launch is unavailable in your region.",
      "Your answers match a restriction in the stock-token issuer’s current disclosures. You can still explore the demo.",
    );
  }
  if (!residence || !location || input.usPerson !== "no") {
    return result(
      "needs_information",
      "More information is needed.",
      "Select your residence and current location, and confirm whether the US-person restriction applies. If you are unsure, eligibility remains unconfirmed.",
    );
  }
  return result(
    "pending",
    "Availability is not yet confirmed.",
    "Your answers do not match the listed exclusions, but your country has not been approved for launch. This check does not verify eligibility or grant live access. Live account access is handled separately through sign-in and owner wallet approval.",
  );
}
