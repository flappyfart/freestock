import { json } from "../../../../lib/http";
import { stockLendingCatalogue } from "../../../../lib/stock-lending-markets";

export async function GET() {
  return json(await stockLendingCatalogue());
}
