import { json } from "../../../../lib/http";
import { chainConfig } from "../../../../lib/live/chain";
export async function GET() {
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
    pilotStock: "NVDA",
    pilotDepositLimit: "100000000",
    eligibilityConfirmed: false,
    contractDeployed: false,
    realDepositsEnabled: false,
    realTradingEnabled: false,
    backgroundAutomationEnabled: false,
  });
}
