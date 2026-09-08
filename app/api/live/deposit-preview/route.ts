import { identity, json } from "../../../../lib/http";
import { previewDeposit } from "../../../../lib/live/chain";
import { LiveError } from "../../../../lib/live/config";
export async function GET(request: Request) {
  if (!(await identity())) return json({ error: "Sign in to inspect a deposit." }, 401);
  const q = new URL(request.url).searchParams;
  try {
    return json(await previewDeposit(q.get("address") ?? "", q.get("amount") ?? ""));
  } catch (e) {
    return json(
      { error: e instanceof LiveError ? e.message : "The deposit preview is unavailable." },
      e instanceof LiveError ? e.status : 503,
    );
  }
}
