import { env } from "cloudflare:workers";
import { hasPrivatePilotAccess } from "./pilot-access";
export function pilotPolicy(userId: string | null) {
  const v = env as unknown as {
    FREESTOCK_PILOT_USER_ID?: string;
  };
  const enabled = hasPrivatePilotAccess(userId, v.FREESTOCK_PILOT_USER_ID);
  return {
    enabled,
    eligibilityVerified: false,
    backgroundAutomationEnabled: false,
  };
}
