import { catalogue } from "../../../lib/markets";
import { json } from "../../../lib/http";
export async function GET() {
  return json(await catalogue());
}
