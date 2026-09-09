import { AsyncLocalStorage } from "node:async_hooks";
import { createRpcReader, RpcReadError } from "./rpc-reader";
import { env } from "cloudflare:workers";
import { Interface } from "ethers";
import { address, amount } from "./validation";
export { address, amount } from "./validation";
import {
  CHAIN_ID,
  RPC_URL,
  USDG,
  VAULT,
  ERC20_ABI,
  VAULT_ABI,
  STOCK_TOKENS,
  LiveError,
} from "./config";
const erc20 = new Interface(ERC20_ABI),
  vault = new Interface(VAULT_ABI);
export function chainConfig() {
  const v = env as unknown as { ROBINHOOD_RPC_URL?: string };
  return { rpc: v.ROBINHOOD_RPC_URL || RPC_URL, dedicatedRpc: !!v.ROBINHOOD_RPC_URL };
}
const rpcScope = new AsyncLocalStorage<ReturnType<typeof createRpcReader>>();
function newRpcReader() {
  return createRpcReader({ report: (event) => console.warn("robinhood_rpc_read_failure", event) });
}
// Keep fetch promises inside one inbound request; never share I/O between Worker requests.
export function withRpcReads<T>(run: () => Promise<T>): Promise<T> {
  return rpcScope.getStore() ? run() : rpcScope.run(newRpcReader(), run);
}
export async function rpc(method: string, params: unknown[]) {
  try {
    return await (rpcScope.getStore() ?? newRpcReader())(chainConfig().rpc, method, params);
  } catch (error) {
    if (error instanceof RpcReadError)
      throw new LiveError(error.message, error.code === "unsupported" ? 400 : 503);
    throw error;
  }
}
export async function read(
  to: string,
  iface: Interface,
  name: string,
  args: unknown[],
  block: string,
): Promise<unknown[]> {
  const result = await rpc("eth_call", [{ to, data: iface.encodeFunctionData(name, args) }, block]);
  if (typeof result !== "string") throw new LiveError("Invalid chain response.", 503);
  return Array.from(iface.decodeFunctionResult(name, result));
}
export async function pin() {
  const chain = await rpc("eth_chainId", []);
  if (typeof chain !== "string" || Number(BigInt(chain)) !== CHAIN_ID)
    throw new LiveError("The RPC is connected to the wrong chain.", 503);
  const block = await rpc("eth_blockNumber", []);
  if (typeof block !== "string" || !/^0x[\da-f]+$/i.test(block))
    throw new LiveError("Missing chain block.", 503);
  return block;
}
export async function walletSnapshot(account: string) {
  return withRpcReads(async () => {
    const owner = address(account),
      block = await pin();
    const [usd, shares, eth, asset, decimals, stockBalances, info] = await Promise.all([
      read(USDG, erc20, "balanceOf", [owner], block),
      read(VAULT, vault, "balanceOf", [owner], block),
      rpc("eth_getBalance", [owner, block]),
      read(VAULT, vault, "asset", [], block),
      read(USDG, erc20, "decimals", [], block),
      Promise.all(
        STOCK_TOKENS.map(async (s) => ({
          symbol: s.symbol,
          address: s.address,
          balance: String((await read(s.address, erc20, "balanceOf", [owner], block))[0]),
        })),
      ),
      rpc("eth_getBlockByNumber", [block, false]),
    ]);
    if (String(asset[0]).toLowerCase() !== USDG.toLowerCase() || String(decimals[0]) !== "6")
      throw new LiveError("The vault asset configuration changed.", 503);
    const assets =
      BigInt(String(shares[0])) === 0n
        ? 0n
        : (await read(VAULT, vault, "previewRedeem", [shares[0]], block))[0];
    if (typeof eth !== "string" || !/^0x[\da-f]+$/i.test(eth))
      throw new LiveError("Invalid ETH balance response.", 503);
    const b = info as { hash?: string; timestamp?: string };
    return {
      mode: "mainnet-read-only",
      chainId: CHAIN_ID,
      address: owner,
      block: Number(BigInt(block)),
      blockHash: b.hash,
      blockTime: b.timestamp ? new Date(Number(BigInt(b.timestamp)) * 1000).toISOString() : null,
      observedAt: new Date().toISOString(),
      usdg: String(usd[0]),
      eth: BigInt(eth).toString(),
      vaultShares: String(shares[0]),
      vaultAssets: String(assets),
      stocks: stockBalances,
      realTradingEnabled: false,
    };
  });
}
export async function previewDeposit(account: string, input: string) {
  return withRpcReads(async () => {
    const owner = address(account),
      assets = amount(input),
      block = await pin();
    const [underlying, shares, balance, allowance, ...gates] = await Promise.all([
      read(VAULT, vault, "asset", [], block),
      read(VAULT, vault, "previewDeposit", [assets], block),
      read(USDG, erc20, "balanceOf", [owner], block),
      read(USDG, erc20, "allowance", [owner, VAULT], block),
      ...["sendAssetsGate", "receiveSharesGate", "sendSharesGate", "receiveAssetsGate"].map(
        (name) => read(VAULT, vault, name, [], block),
      ),
    ]);
    if (String(underlying[0]).toLowerCase() !== USDG.toLowerCase())
      throw new LiveError("Vault asset mismatch.", 503);
    const transaction = {
      from: owner,
      to: VAULT,
      data: vault.encodeFunctionData("deposit", [assets, owner]),
      value: "0x0",
      chainId: "0x1237",
    };
    let simulation: "passed" | "needs-balance" | "needs-approval" | "failed" = "failed";
    if (BigInt(String(balance[0])) < assets) simulation = "needs-balance";
    else if (BigInt(String(allowance[0])) < assets) simulation = "needs-approval";
    else {
      try {
        const result = await rpc("eth_call", [
          { from: owner, to: transaction.to, data: transaction.data, value: "0x0" },
          block,
        ]);
        if (
          typeof result !== "string" ||
          BigInt(vault.decodeFunctionResult("deposit", result)[0]) <= 0n
        )
          throw new LiveError("Invalid deposit result.", 503);
        simulation = "passed";
      } catch {
        simulation = "failed";
      }
    }
    return {
      mode: "unsigned-preview",
      block: Number(BigInt(block)),
      chainId: CHAIN_ID,
      assets: assets.toString(),
      previewShares: String(shares[0]),
      simulation,
      gates: gates.map((g) => String(g[0])),
      transaction,
      approval: {
        from: owner,
        to: USDG,
        data: erc20.encodeFunctionData("approve", [VAULT, assets]),
        value: "0x0",
        chainId: "0x1237",
      },
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      canSubmit: false,
      reason:
        "This read-only check previews a direct vault deposit. Open Your position in Dashboard for a reviewed yield-account deposit.",
    };
  });
}
