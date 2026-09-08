import { json } from "../../../lib/http";
export function GET() {
  return json({
    status: "ok",
    product: "freestock",
    mode: "simulation",
    realDepositsEnabled: false,
    realTradingEnabled: false,
    randomness: "server-crypto-simulation",
    schema: 1,
  });
}
