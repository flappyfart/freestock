import { identity, json } from "../../../../lib/http";
import { stockQuote } from "../../../../lib/live/quote";
import { LiveError } from "../../../../lib/live/config";
export async function GET(request: Request) {
  if (!(await identity())) return json({ error: "Sign in to request a stock quote." }, 401);
  const q = new URL(request.url).searchParams;
  try {
    return json(await stockQuote(q.get("symbol") ?? "", q.get("amount") ?? ""));
  } catch (e) {
    return json(
      { error: e instanceof LiveError ? e.message : "This stock route could not be quoted." },
      e instanceof LiveError ? e.status : 503,
    );
  }
}
