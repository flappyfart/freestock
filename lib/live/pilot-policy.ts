import { env } from "cloudflare:workers";
export function pilotPolicy(userId: string | null) {
  const v = env as unknown as {
    FREESTOCK_PILOT_USER_ID?: string;
    FREESTOCK_PILOT_COUNTRY?: string;
    FREESTOCK_PILOT_US_PERSON?: string;
  };
  const enabled =
    !!userId &&
    userId === v.FREESTOCK_PILOT_USER_ID &&
    v.FREESTOCK_PILOT_COUNTRY === "NO" &&
    v.FREESTOCK_PILOT_US_PERSON === "no";
  return {
    enabled,
    country: "NO",
    declaration: "Norway residence and location; not a U.S. person or acting for one.",
    eligibilityVerified: false,
    backgroundAutomationEnabled: false,
  };
}
