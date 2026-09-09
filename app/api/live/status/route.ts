import { identity, json } from "../../../../lib/http";
import { chainConfig, pin } from "../../../../lib/live/chain";
import { pilotPolicy } from "../../../../lib/live/pilot-policy";
export async function GET() {
  const pilot = pilotPolicy(await identity());
  const c = chainConfig();
  let chainHealth: { available: boolean; block?: number; message?: string };
  try {
    const block = await pin();
    chainHealth = { available: true, block: Number(BigInt(block)) };
  } catch {
    chainHealth = {
      available: false,
      message:
        "The website cannot reach Robinhood Chain right now. Retry the connection before reviewing a transaction.",
    };
  }
  return json({
    chainHealth,
    chainId: 4663,
    walletReads: true,
    vaultPreviews: true,
    tradingProvider: "Uniswap V3",
    tradingKeyRequired: false,
    dedicatedRpcConfigured: c.dedicatedRpc,
    accountSetupPreviews: true,
    pilotStocks: ["NVDA", "AAPL", "TSLA", "GOOGL", "SPY"],
    pilotDepositLimit: "100000000",
    eligibilityConfirmed: false,
    walletPilotEnabled: pilot.enabled,
    realDepositsEnabled: pilot.enabled,
    realTradingEnabled: pilot.enabled,
    backgroundAutomationEnabled: false,
    persistentActivityEnabled: true,
  });
}
