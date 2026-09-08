import { account } from "../../../lib/store";
import { identity, json } from "../../../lib/http";
export async function GET() {
  const owner = await identity();
  if (!owner) return json({ error: "Sign in to save your preview." }, 401);
  try {
    return json({ ...(await account(owner)), mode: "simulation", realDepositsEnabled: false });
  } catch {
    return json({ error: "Your account could not be loaded. Please retry." }, 503);
  }
}
