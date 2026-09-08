import { Interface, ZeroAddress } from "ethers";
import { amount, read, rpc, address } from "./chain";
import { USDG, STOCK_TOKENS, LiveError } from "./config";
export const FACTORY = "0x1f7d7550b1b028f7571e69a784071f0205fd2efa";
export const QUOTER = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7";
export const ROUTER = "0xcaf681a66d020601342297493863e78c959e5cb2";
const factory = new Interface(["function getPool(address,address,uint24) view returns(address)"]);
const quoter = new Interface([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns(uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);
export async function stockQuote(symbol: string, input: string) {
  const stock = STOCK_TOKENS.find((s) => s.symbol === symbol);
  if (!stock) throw new LiveError("Choose a supported Stock Token.", 400);
  const assets = amount(input),
    fee = 500;
  const chain = await rpc("eth_chainId", []);
  if (typeof chain !== "string" || BigInt(chain) !== 4663n)
    throw new LiveError("Wrong chain.", 503);
  const block = await rpc("eth_blockNumber", []);
  if (typeof block !== "string") throw new LiveError("No chain block.", 503);
  const pool = String(
    (await read(FACTORY, factory, "getPool", [USDG, stock.address, fee], block))[0],
  );
  if (pool === ZeroAddress)
    throw new LiveError(`No verified 0.05% USDG/${symbol} pool is available.`, 422);
  const output = await read(
    QUOTER,
    quoter,
    "quoteExactInputSingle",
    [[USDG, stock.address, assets, fee, 0]],
    block,
  );
  const quoted = BigInt(String(output[0]));
  if (quoted <= 0n) throw new LiveError("This pool cannot quote the requested amount.", 422);
  // Half-size comparison rejects exhausted/range-limited or strongly nonlinear quotes.
  const half = assets / 2n;
  if (half > 0n) {
    const smaller = await read(
      QUOTER,
      quoter,
      "quoteExactInputSingle",
      [[USDG, stock.address, half, fee, 0]],
      block,
    );
    const halfOut = BigInt(String(smaller[0]));
    if (halfOut <= 0n || quoted * 10000n < ((halfOut * assets) / half) * 9800n)
      throw new LiveError("The route has excessive price impact for this amount.", 422);
  }
  return {
    mode: "onchain-quote",
    chainId: 4663,
    block: Number(BigInt(block)),
    pool: address(pool),
    router: ROUTER,
    tokenIn: USDG,
    tokenOut: stock.address,
    symbol,
    fee,
    amountIn: assets.toString(),
    amountOut: quoted.toString(),
    minimumOut: ((quoted * 9900n) / 10000n).toString(),
    slippageBps: 100,
    observedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    executionEnabled: false,
    note: "Onchain AMM quote with a 1% minimum-output allowance. Gas excluded. A quote is not a trade.",
  };
}
