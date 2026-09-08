import { json } from "../../../lib/http";
import { LAUNCH_POLICY } from "../../../lib/launch-policy";
export function GET() {
  return json({
    status: "ok",
    product: "freestock",
    mode: "simulation",
    walletPilot: "separate, participant-restricted, wallet-approved",
    walletPilotStatusEndpoint: "/api/live/status",
    realDepositsEnabled: LAUNCH_POLICY.realDepositsEnabled,
    realTradingEnabled: LAUNCH_POLICY.realTradingEnabled,
    launch: LAUNCH_POLICY,
    earnings: "explicit-time-simulation",
    automation: "simulation-step-only",
    schema: 1,
  });
}
