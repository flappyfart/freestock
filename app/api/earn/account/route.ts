import { account } from "../../../../lib/earn-store";
import { identity, json } from "../../../../lib/http";
export async function GET() {
  const owner = await identity();
  if (!owner) return json({ error: "Sign in to save your demo account." }, 401);
  try {
    return json({
      ...(await account(owner)),
      mode: "simulation",
      realDepositsEnabled: false,
      realTradingEnabled: false,
    });
  } catch {
    return json({ error: "Your demo account is unavailable. Please retry." }, 503);
  }
}
