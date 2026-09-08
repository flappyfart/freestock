import { identity, json } from "../../../../lib/http";
import { chainConfig } from "../../../../lib/live/chain";
import { pilotPolicy } from "../../../../lib/live/pilot-policy";
export async function GET() {
  const pilot = pilotPolicy(await identity());
  const c = chainConfig();
  return json({
    chainId: 4663,
    walletReads: true,
    vaultPreviews: true,
    tradingProvider: "Uniswap V3",
    tradingKeyRequired: false,
    dedicatedRpcConfigured: c.dedicatedRpc,
    accountSetupPreviews: true,
    pilotCountry: "NO",
    pilotStocks: ["NVDA", "AAPL", "TSLA", "GOOGL", "SPY"],
    pilotDepositLimit: "100000000",
    eligibilityConfirmed: false,
    walletPilotEnabled: pilot.enabled,
    participantDeclaration: pilot.enabled ? pilot.declaration : null,
    realDepositsEnabled: pilot.enabled,
    realTradingEnabled: pilot.enabled,
    backgroundAutomationEnabled: false,
  });
}
