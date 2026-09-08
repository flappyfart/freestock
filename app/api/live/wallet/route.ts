import { identity, json } from "../../../../lib/http";
import { walletSnapshot } from "../../../../lib/live/chain";
import { LiveError } from "../../../../lib/live/config";
export async function GET(request: Request) {
  if (!(await identity())) return json({ error: "Sign in to inspect a wallet." }, 401);
  try {
    return json(await walletSnapshot(new URL(request.url).searchParams.get("address") ?? ""));
  } catch (e) {
    return json(
      { error: e instanceof LiveError ? e.message : "Wallet data could not be loaded." },
      e instanceof LiveError ? e.status : 503,
    );
  }
}
