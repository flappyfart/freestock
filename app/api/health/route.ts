import { identity, json } from "../../../lib/http";
import { pilotPolicy } from "../../../lib/live/pilot-policy";
export async function GET() {
  const access = pilotPolicy(await identity());
  return json({
    status: "ok",
    product: "freestock",
    mode: "live-wallet-with-simulation",
    liveWalletAvailable: true,
    access: "signed-in-wallet",
    liveStatusEndpoint: "/api/live/status",
    realDepositsEnabled: access.enabled,
    realTradingEnabled: access.enabled,
    launch: { phase: "live", audience: "non-us-users-subject-to-provider-restrictions" },
    earnings: { simulation: "explicit-time-simulation", live: "wallet-approved-transactions" },
    automation: "recommendations-with-manual-approval",
    backgroundAutomationEnabled: false,
    schema: 2,
  });
}
