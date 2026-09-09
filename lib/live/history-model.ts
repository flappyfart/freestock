import { Interface } from "ethers";
import artifact from "../../contracts/artifacts/FreestockYieldAccount.artifact.json" with { type: "json" };
import { CHAIN_ID, USDG } from "./config.ts";
import { ENABLED_STOCKS } from "./basket.ts";

export type HistoryEvent = {
  name: "Deposited" | "Withdrawn" | "Compounded" | "StockPurchased" | "Closed" | "Approval";
  logIndex: number;
  assetAmount: string;
  shares?: string;
  principalAfter?: string;
  token?: string;
  tokenAmount?: string;
};
export type HistoryRecord = {
  chainId: number;
  wallet: string;
  account: string;
  hash: string;
  nonce: string;
  action: string;
  status: "pending" | "confirmed" | "reverted" | "rechecking" | "replaced";
  block: number | null;
  blockHash: string | null;
  transactionIndex: number | null;
  timestamp: string | null;
  gasWei: string | null;
  events: HistoryEvent[];
  replaces?: string;
  replacedBy?: string;
};
export type SavedLiveAccount = {
  wallet: string;
  account: string;
  chainId: number;
  deployment: string;
  deploymentBlock: number;
  deploymentBlockHash: string;
  syncedBlock: number | null;
  syncedBlockHash: string | null;
  headBlock: number | null;
  version: number;
  updatedAt: string;
};
export const historyAbi = new Interface(artifact.abi);
export const approvalAbi = new Interface([
  "function approve(address spender,uint256 amount) returns(bool)",
  "event Approval(address indexed owner,address indexed spender,uint256 value)",
]);
export const eventNames = [
  "Deposited",
  "Withdrawn",
  "Compounded",
  "StockPurchased",
  "Closed",
] as const;
export const eventTopics = eventNames.map((name) => historyAbi.getEvent(name)!.topicHash);
export const sameAddress = (a: unknown, b: string) =>
  typeof a === "string" && a.toLowerCase() === b.toLowerCase();
export function historyHash(value: unknown): string {
  if (typeof value !== "string" || !/^0x[\da-f]{64}$/i.test(value))
    throw Error("Invalid transaction or block hash.");
  return value.toLowerCase();
}
export function historyAddress(value: unknown): string {
  if (typeof value !== "string" || !/^0x[\da-f]{40}$/i.test(value))
    throw Error("Invalid wallet or account address.");
  return value.toLowerCase();
}
export function quantity(value: unknown): bigint {
  if (typeof value !== "string" || !/^0x[\da-f]+$/i.test(value))
    throw Error("Invalid chain quantity.");
  const n = BigInt(value);
  if (n > (1n << 256n) - 1n) throw Error("Invalid chain quantity.");
  return n;
}
export function blockNumber(value: unknown): number {
  const n = quantity(value);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw Error("Chain number exceeds supported range.");
  return Number(n);
}
export function historyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Incomplete chain response.");
  return value as Record<string, unknown>;
}
export function decodeHistoryEvents(
  logs: unknown,
  scope: { account: string; wallet: string; hash: string; block: number; blockHash: string },
) {
  if (!Array.isArray(logs) || logs.length > 500)
    throw Error("Incomplete or oversized transaction logs.");
  const events: HistoryEvent[] = [],
    seen = new Set<number>();
  for (const input of logs) {
    const log = historyObject(input);
    const isAccount = sameAddress(log.address, scope.account);
    const isApproval =
      sameAddress(log.address, USDG) &&
      Array.isArray(log.topics) &&
      log.topics[0] === approvalAbi.getEvent("Approval")!.topicHash;
    if (!isAccount && !isApproval) continue;
    if (
      log.removed === true ||
      historyHash(log.transactionHash) !== historyHash(scope.hash) ||
      historyHash(log.blockHash) !== historyHash(scope.blockHash) ||
      blockNumber(log.blockNumber) !== scope.block ||
      !Array.isArray(log.topics) ||
      typeof log.data !== "string"
    )
      throw Error("Transaction log identity changed.");
    const logIndex = blockNumber(log.logIndex);
    if (seen.has(logIndex)) throw Error("Duplicate event index.");
    seen.add(logIndex);
    const event = (isAccount ? historyAbi : approvalAbi).parseLog({
      topics: log.topics.map(String),
      data: log.data,
    });
    if (!event) throw Error("Unsupported account event.");
    if (event.name === "Approval") {
      if (!sameAddress(event.args[0], scope.wallet) || !sameAddress(event.args[1], scope.account))
        continue;
      events.push({ name: "Approval", logIndex, assetAmount: String(event.args[2]) });
    } else if (event.name === "StockPurchased") {
      if (!ENABLED_STOCKS.some((s) => sameAddress(event.args[0], s.address)))
        throw Error("Unknown stock token in account event.");
      events.push({
        name: "StockPurchased",
        logIndex,
        token: historyAddress(event.args[0]),
        assetAmount: String(event.args[1]),
        tokenAmount: String(event.args[2]),
      });
    } else if (event.name === "Deposited")
      events.push({
        name: "Deposited",
        logIndex,
        assetAmount: String(event.args[0]),
        shares: String(event.args[1]),
        principalAfter: String(event.args[2]),
      });
    else if (event.name === "Withdrawn" || event.name === "Compounded")
      events.push({
        name: event.name,
        logIndex,
        assetAmount: String(event.args[0]),
        principalAfter: String(event.args[1]),
      });
    else if (event.name === "Closed")
      events.push({ name: "Closed", logIndex, assetAmount: String(event.args[0]) });
    else throw Error("Unknown account event.");
  }
  return events.sort((a, b) => a.logIndex - b.logIndex);
}
export function historyTotals(records: HistoryRecord[]) {
  let deposited = 0n,
    withdrawn = 0n,
    converted = 0n,
    reserved = 0n;
  const stocks = new Map<string, bigint>(),
    seen = new Set<string>();
  for (const r of records) {
    if (r.chainId !== CHAIN_ID || r.status !== "confirmed") continue;
    for (const e of r.events) {
      const key = `${r.chainId}:${r.hash.toLowerCase()}:${e.logIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const amount = BigInt(e.assetAmount);
      if (e.name === "Deposited") deposited += amount;
      if (e.name === "Withdrawn" || e.name === "Closed") withdrawn += amount;
      if (e.name === "Compounded") reserved += amount;
      if (e.name === "StockPurchased" && e.token && e.tokenAmount) {
        converted += amount;
        stocks.set(e.token, (stocks.get(e.token) ?? 0n) + BigInt(e.tokenAmount));
      }
    }
  }
  return {
    deposited: deposited.toString(),
    withdrawn: withdrawn.toString(),
    converted: converted.toString(),
    reserved: reserved.toString(),
    stocks: Array.from(stocks, ([address, amount]) => ({ address, amount: amount.toString() })),
  };
}
