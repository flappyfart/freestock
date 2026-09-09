import { json } from "../../../lib/http";
export async function POST() {
  return json(
    {
      error:
        "The prize preview is retired. Open the new Earn page to use DeFi simulated positions.",
    },
    410,
  );
}
