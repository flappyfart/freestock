import { json } from '../../../../lib/http';
import { walletSession } from '../../../../lib/wallet-auth';
export async function GET() {
  try {
    const session = await walletSession();
    return json({
      wallet: session?.wallet ?? null,
      expiresAt: session?.expiresAt ?? null,
    });
  } catch {
    return json({ error: 'Wallet session is temporarily unavailable.' }, 503);
  }
}
