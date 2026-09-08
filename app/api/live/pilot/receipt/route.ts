import { identity, json } from "../../../../../lib/http";
import { pilotReceipt } from "../../../../../lib/live/pilot";
import { LiveError } from "../../../../../lib/live/config";
export async function GET(request: Request) {
  const user = await identity();
  if (!user) return json({ error: "Sign in to use the wallet pilot." }, 401);
  const q = new URL(request.url).searchParams;
  try {
    return json(
      await pilotReceipt(
        q.get("owner") ?? "",
        q.get("deployment") ?? "",
        q.get("hash") ?? "",
        q.get("nonce") ?? undefined,
      ),
    );
  } catch (e) {
    return json(
      {
        error:
          e instanceof LiveError
            ? e.message
            : "The chain could not complete this action preview. Check wallet funds, current liquidity and try again.",
      },
      e instanceof LiveError ? e.status : 503,
    );
  }
}
