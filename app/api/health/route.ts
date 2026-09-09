import { json } from "../../../lib/http";
import { LAUNCH_POLICY } from "../../../lib/launch-policy";
export function GET() {
  return json({
    status: "ok",
    product: "freestock",
    mode: "wallet-pilot-with-practice",
    walletPilot: "participant-restricted, wallet-approved",
    walletPilotStatusEndpoint: "/api/live/status",
    realDepositsEnabled: LAUNCH_POLICY.realDepositsEnabled,
    realTradingEnabled: LAUNCH_POLICY.realTradingEnabled,
    launch: LAUNCH_POLICY,
    earnings: { practice: "explicit-time-simulation", live: "chain-reads" },
    automation: "simulation-step-only",
    schema: 1,
  });
}
