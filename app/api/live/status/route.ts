import { walletSession } from '../../../../lib/wallet-auth';
import { json } from '../../../../lib/http';
import { chainConfig, pin } from '../../../../lib/live/chain';
import { pilotPolicy } from '../../../../lib/live/pilot-policy';
import { liveSessionScope } from '../../../../lib/live/pilot-access';
export async function GET() {
  const session = await walletSession();
  const userId = session?.userId ?? null;
  const pilot = pilotPolicy(userId);
  const c = chainConfig();
  let chainHealth: { available: boolean; block?: number; message?: string };
  try {
    const block = await pin();
    chainHealth = { available: true, block: Number(BigInt(block)) };
  } catch {
    chainHealth = {
      available: false,
      message:
        'The website cannot reach Robinhood Chain right now. Retry the connection before reviewing a transaction.',
    };
  }
  return json({
    chainHealth,
    chainId: 4663,
    walletReads: true,
    vaultPreviews: true,
    tradingProvider: 'Uniswap V3',
    tradingKeyRequired: false,
    dedicatedRpcConfigured: c.dedicatedRpc,
    accountSetupPreviews: true,
    access: 'wallet-signature',
    authenticatedWallet: session?.wallet ?? null,
    signInRequired: !pilot.enabled,
    sessionScope: await liveSessionScope(userId),
    liveStocks: ['NVDA', 'AAPL', 'TSLA', 'GOOGL', 'SPY'],
    depositLimit: null,
    newAccountVersion: 'v2',
    legacyDepositLimit: '100000000',
    eligibilityConfirmed: false,
    walletTransactionsEnabled: pilot.enabled,
    realDepositsEnabled: pilot.enabled,
    realTradingEnabled: pilot.enabled,
    backgroundAutomationEnabled: false,
    persistentActivityEnabled: true,
  });
}
