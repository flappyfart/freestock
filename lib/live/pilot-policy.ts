import { hasLiveWalletAccess } from "./pilot-access";
export function pilotPolicy(userId: string | null) {
  return {
    enabled: hasLiveWalletAccess(userId),
    eligibilityVerified: false,
    backgroundAutomationEnabled: false,
  };
}
