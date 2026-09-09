import { withRpcReads } from "./chain";
import { Interface, getCreateAddress, formatUnits } from "ethers";
import artifact from "../../contracts/artifacts/FreestockYieldAccount.artifact.json" with { type: "json" };
import {
  accountPlan,
  matchesAccountRuntime,
  DEPOSIT_LIMIT,
  PILOT_ROUTER,
  PILOT_STOCKS,
} from "./account-plan";
import { amount, address, pin, read, rpc } from "./chain";
import { VAULT, USDG, ERC20_ABI, VAULT_ABI, LiveError } from "./config";
import { stockQuote } from "./quote";
import { allocateBasket } from "./basket";
import { pilotPolicy } from "./pilot-policy";
import { positionBudget } from "./position-budget";
const accountAbi = new Interface(artifact.abi),
  tokenAbi = new Interface(ERC20_ABI),
  vaultAbi = new Interface(VAULT_ABI);
type Row = Record<string, unknown>;
export function txHash(value: unknown) {
  if (typeof value !== "string" || !/^0x[\da-f]{64}$/i.test(value))
    throw new LiveError("Enter a valid transaction hash.", 400);
  return value;
}
function object(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new LiveError("Invalid transaction response.", 503);
  return value as Row;
}
function hex(value: unknown) {
  if (typeof value !== "string" || !/^0x[\da-f]+$/i.test(value))
    throw new LiveError("Invalid chain quantity.", 503);
  return BigInt(value);
}
const same = (a: unknown, b: string) =>
  typeof a === "string" && a.toLowerCase() === b.toLowerCase();
function parsedCall(abi: Interface, input: unknown) {
  if (typeof input !== "string") return null;
  try {
    return abi.parseTransaction({ data: input });
  } catch {
    return null;
  }
}
async function mined(hash: string) {
  const value = await rpc("eth_getTransactionReceipt", [txHash(hash)]);
  if (!value) return null;
  const receipt = object(value),
    transaction = object(await rpc("eth_getTransactionByHash", [hash]));
  if (
    !same(receipt.transactionHash, hash) ||
    !same(transaction.hash, hash) ||
    hex(transaction.chainId) !== 4663n
  )
    throw new LiveError("Transaction identity mismatch.", 503);
  const block = object(await rpc("eth_getBlockByNumber", [receipt.blockNumber, false]));
  if (!same(block.hash, String(receipt.blockHash)))
    throw new LiveError("The transaction block changed. Refresh its confirmation.", 409);
  return { receipt, transaction, block };
}
export async function verifiedAccount(ownerInput: string, deploymentInput: string, block: string) {
  const owner = address(ownerInput),
    deployment = txHash(deploymentInput);
  const result = await mined(deployment);
  if (!result) throw new LiveError("Account deployment is still pending.", 409);
  const { receipt, transaction } = result;
  const expected = accountPlan(owner);
  if (
    hex(receipt.status) !== 1n ||
    transaction.to !== null ||
    !same(transaction.from, owner) ||
    !same(transaction.input, expected.transaction.data) ||
    hex(transaction.value) !== 0n
  )
    throw new LiveError(
      "This is not a successful freestock account deployment from the connected wallet.",
      422,
    );
  const account = address(receipt.contractAddress);
  const derived = getCreateAddress({ from: owner, nonce: hex(transaction.nonce) });
  if (account !== derived || !matchesAccountRuntime(await rpc("eth_getCode", [account, block])))
    throw new LiveError("The account code does not match the tested deployment.", 422);
  const names = ["owner", "asset", "vault", "router", "depositCap"];
  const values = await Promise.all(names.map((n) => read(account, accountAbi, n, [], block)));
  if (
    !same(values[0][0], owner) ||
    !same(values[1][0], USDG) ||
    !same(values[2][0], VAULT) ||
    !same(values[3][0], PILOT_ROUTER) ||
    BigInt(String(values[4][0])) !== DEPOSIT_LIMIT
  )
    throw new LiveError("The account ownership or fixed configuration does not match.", 422);
  return { owner, account, deployment };
}
async function balances(owner: string, account: string, block: string) {
  const [principal, value, gains, usd, stock, allowance, stocks] = await Promise.all([
    read(account, accountAbi, "principal", [], block),
    read(account, accountAbi, "totalAssets", [], block),
    read(account, accountAbi, "availableYield", [], block),
    read(USDG, tokenAbi, "balanceOf", [owner], block),
    read(PILOT_STOCKS[0].address, tokenAbi, "balanceOf", [owner], block),
    read(USDG, tokenAbi, "allowance", [owner, account], block),
    Promise.all(
      PILOT_STOCKS.map(async (s) => ({
        symbol: s.symbol,
        address: s.address,
        balance: String((await read(s.address, tokenAbi, "balanceOf", [owner], block))[0]),
      })),
    ),
  ]);
  const available = BigInt(String(gains[0]));
  const budget = positionBudget(BigInt(String(principal[0])), BigInt(String(value[0])));
  if (budget.surplus !== available)
    throw new LiveError("Position balances are inconsistent. Refresh before continuing.", 503);
  return {
    principal: String(principal[0]),
    assetValue: String(value[0]),
    availableGains: available.toString(),
    spendableWithRoundingBuffer: budget.convertible.toString(),
    walletUsdg: String(usd[0]),
    walletNvda: String(stock[0]),
    stocks,
    allowance: String(allowance[0]),
    block: Number(BigInt(block)),
  };
}
export async function pilotSnapshot(owner: string, deployment: string) {
  return withRpcReads(async () => {
    const block = await pin(),
      verified = await verifiedAccount(owner, deployment, block);
    return { ...verified, ...(await balances(verified.owner, verified.account, block)) };
  });
}
type Transaction = {
  from: string;
  to?: string;
  data: string;
  value: string;
  chainId: string;
  gas?: string;
  nonce?: string;
};
export async function preparePilot(userId: string, query: URLSearchParams) {
  return withRpcReads(async () => {
    const owner = address(query.get("owner")),
      action = query.get("action") ?? "";
    if (!["deploy", "approve", "deposit", "harvest", "compound", "withdraw"].includes(action))
      throw new LiveError("Choose a supported pilot action.", 400);
    // Withdrawal preparation stays available even if pilot entry/trading is later disabled.
    const policy = pilotPolicy(userId);
    if (!policy.enabled && action !== "withdraw")
      throw new LiveError("This wallet pilot is not enabled for the signed-in account.", 403);
    const block = await pin();
    let transaction: Transaction,
      summary: string,
      account: string | null = null;
    const minimumOut = null,
      tokenOut = null;
    let assets = 0n;
    let purchases: {
      symbol: string;
      tokenOut: string;
      amountIn: string;
      amountOut: string;
      minimumOut: string;
      fee: number;
      weightBps: number;
    }[] = [];
    if (action === "deploy") {
      if ((await rpc("eth_getCode", [owner, block])) !== "0x")
        throw new LiveError(
          "This pilot requires a wallet that deploys directly from its own address.",
          422,
        );
      transaction = accountPlan(owner).transaction;
      summary =
        "Create your own stock-yield account. This spends ETH for deployment gas; it does not deposit USDG.";
    } else {
      const verified = await verifiedAccount(owner, query.get("deployment") ?? "", block);
      account = verified.account;
      const state = await balances(owner, account, block);
      transaction = { from: owner, to: account, data: "0x", value: "0x0", chainId: "0x1237" };
      if (action === "withdraw") {
        assets = BigInt(state.assetValue);
        if (assets <= 0n) throw new LiveError("The account has no USDG value to withdraw.", 422);
        const minAssets = assets > 2n ? assets - 2n : assets;
        transaction.data = accountAbi.encodeFunctionData("withdrawAll", [minAssets]);
        summary =
          "Withdraw the entire account to your wallet. If the simulated withdrawal value falls by more than 0.000002 USDG, the transaction reverts.";
      } else {
        assets = amount(query.get("amount"));
        if (action === "approve" || action === "deposit") {
          if (BigInt(state.principal) + assets > DEPOSIT_LIMIT)
            throw new LiveError("This deposit would exceed the 100 USDG principal limit.", 422);
          if (BigInt(state.walletUsdg) < assets)
            throw new LiveError("The wallet does not have enough USDG.", 422);
          if (action === "approve") {
            transaction.to = USDG;
            transaction.data = tokenAbi.encodeFunctionData("approve", [account, assets]);
            summary =
              "Allow only this USDG amount to be deposited into your verified account. This is not an unlimited approval.";
          } else {
            if (BigInt(state.allowance) < assets)
              throw new LiveError("Approve this USDG amount for your account first.", 422);
            const shares = BigInt(
              String((await read(VAULT, vaultAbi, "previewDeposit", [assets], block))[0]),
            );
            if (shares <= 2n) throw new LiveError("Deposit too small.", 422);
            transaction.data = accountAbi.encodeFunctionData("deposit", [
              assets,
              (shares * 9990n) / 10000n,
            ]);
            summary =
              "Move USDG from your wallet into the verified lending account. The deposit accepts at most 0.1% fewer shares than the current preview.";
          }
        } else {
          if (assets > BigInt(state.spendableWithRoundingBuffer))
            throw new LiveError(
              "This amount exceeds gains available above principal, after the rounding buffer.",
              422,
            );
          if (action === "compound") {
            transaction.data = accountAbi.encodeFunctionData("compound", [assets]);
            summary =
              "Reserve these gains as new principal. The underlying vault shares already accumulate lending returns.";
          } else {
            const raw = query.get("allocations") ?? '[{"symbol":"NVDA","weightBps":10000}]';
            if (raw.length > 1024) throw new LiveError("Allocation is too large.", 400);
            let allocationInput: unknown;
            try {
              allocationInput = JSON.parse(raw);
            } catch {
              throw new LiveError("Invalid stock basket.", 400);
            }
            const allocation = allocateBasket(allocationInput, assets);
            purchases = await Promise.all(
              allocation.map(async (leg) => ({
                ...(await stockQuote(leg.symbol, formatUnits(leg.amount, 6))),
                weightBps: leg.weightBps,
              })),
            );
            const latest = await pin();
            const header = object(await rpc("eth_getBlockByNumber", [latest, false]));
            const deadline = hex(header.timestamp) + 120n;
            transaction.data = accountAbi.encodeFunctionData("harvest", [
              purchases.map((p) => p.tokenOut),
              purchases.map((p) => p.fee),
              purchases.map((p) => BigInt(p.amountIn)),
              purchases.map((p) => BigInt(p.minimumOut)),
              0,
              deadline,
            ]);
            summary =
              "Withdraw only available gains and buy the selected Stock Tokens for your wallet, with a 1% minimum-output allowance per stock. All basket purchases revert together if any purchase cannot meet its limits.";
          }
        }
      }
    }
    const call = {
      from: transaction.from,
      ...(transaction.to ? { to: transaction.to } : {}),
      data: transaction.data,
      value: "0x0",
    };
    const simulation = await rpc("eth_call", [call, "latest"]);
    if (action === "deploy") {
      if (!matchesAccountRuntime(simulation))
        throw new LiveError("Account setup simulation did not match the tested contract.", 503);
    } else if (action === "approve") {
      if (
        typeof simulation !== "string" ||
        tokenAbi.decodeFunctionResult("approve", simulation)[0] !== true
      )
        throw new LiveError("Token approval simulation failed.", 422);
    } else if (action === "deposit") {
      if (
        typeof simulation !== "string" ||
        BigInt(accountAbi.decodeFunctionResult("deposit", simulation)[0]) <= 0n
      )
        throw new LiveError("Deposit simulation failed.", 422);
    } else if (simulation !== "0x")
      throw new LiveError("Unexpected account simulation result.", 503);
    const [gasRaw, priceRaw, ethRaw] = await Promise.all([
      rpc("eth_estimateGas", [call]),
      rpc("eth_gasPrice", []),
      rpc("eth_getBalance", [owner, "latest"]),
    ]);
    const gas = (hex(gasRaw) * 120n + 99n) / 100n,
      cost = gas * hex(priceRaw);
    transaction.gas = `0x${gas.toString(16)}`;
    const nonce = hex(await rpc("eth_getTransactionCount", [owner, "pending"]));
    transaction.nonce = `0x${nonce.toString(16)}`;
    return {
      action,
      deployment: action === "deploy" ? "" : (query.get("deployment") ?? ""),
      owner,
      account,
      assets: assets.toString(),
      summary,
      minimumOut,
      tokenOut,
      purchases,
      transaction,
      simulation: "passed",
      gasLimit: gas.toString(),
      estimatedGasCostWei: cost.toString(),
      hasGasBalance: hex(ethRaw) >= cost,
      expiresAt: new Date(Date.now() + 45000).toISOString(),
      canSubmit: hex(ethRaw) >= cost,
      policy,
      block: Number(BigInt(block)),
    };
  });
}
export async function pilotReceipt(
  ownerInput: string,
  deployment: string,
  hashInput: string,
  nonceInput?: string,
) {
  return withRpcReads(async () => {
    const owner = address(ownerInput),
      hash = txHash(hashInput);
    await pin();
    const result = await mined(hash);
    if (!result) return { status: "pending", hash };
    const { transaction, receipt } = result;
    if (
      nonceInput &&
      (!/^0x[\da-f]+$/i.test(nonceInput) || hex(transaction.nonce) !== BigInt(nonceInput))
    )
      throw new LiveError("This replacement transaction uses a different nonce.", 422);
    if (!same(transaction.from, owner))
      throw new LiveError("The transaction was sent by a different wallet.", 422);
    if (hex(receipt.status) !== 1n) return { status: "reverted", hash };
    if (
      nonceInput &&
      same(transaction.to, owner) &&
      transaction.input === "0x" &&
      hex(transaction.value) === 0n
    )
      return { status: "cancelled", hash };
    if (
      nonceInput &&
      transaction.to === null &&
      !same(transaction.input, accountPlan(owner).transaction.data)
    )
      return { status: "replaced", hash };
    if (nonceInput && transaction.to !== null && !deployment) return { status: "replaced", hash };
    const deploymentHash = transaction.to === null ? hash : txHash(deployment);
    const block = await pin(),
      verified = await verifiedAccount(owner, deploymentHash, block);
    const replaced = async () => ({
      status: "replaced",
      hash,
      deployment: deploymentHash,
      account: verified.account,
      snapshot: { ...verified, ...(await balances(owner, verified.account, block)) },
    });
    if (
      nonceInput &&
      transaction.to !== null &&
      !same(transaction.to, USDG) &&
      !same(transaction.to, verified.account)
    )
      return replaced();
    const events: { name: string; assetAmount: string; token?: string; tokenAmount?: string }[] =
      [];
    if (transaction.to !== null) {
      if (same(transaction.to, USDG)) {
        const parsed = parsedCall(tokenAbi, transaction.input);
        if (
          parsed?.name !== "approve" ||
          !same(parsed.args[0], verified.account) ||
          BigInt(parsed.args[1]) > DEPOSIT_LIMIT ||
          hex(transaction.value) !== 0n
        ) {
          if (nonceInput) return replaced();
          throw new LiveError("The approval does not match this account.", 422);
        }
        events.push({ name: "Approval", assetAmount: String(parsed.args[1]) });
      } else {
        if (!same(transaction.to, verified.account) || hex(transaction.value) !== 0n) {
          if (nonceInput) return replaced();
          throw new LiveError("The transaction targets a different account.", 422);
        }
        const parsed = parsedCall(accountAbi, transaction.input);
        if (!parsed || !["deposit", "compound", "harvest", "withdrawAll"].includes(parsed.name)) {
          if (nonceInput) return replaced();
          throw new LiveError("Unsupported account action.", 422);
        }
        if (!Array.isArray(receipt.logs)) throw new LiveError("Missing receipt logs.", 503);
        for (const log of receipt.logs) {
          const row = object(log);
          if (
            !same(row.address, verified.account) ||
            !Array.isArray(row.topics) ||
            typeof row.data !== "string"
          )
            continue;
          const event = accountAbi.parseLog({ topics: row.topics.map(String), data: row.data });
          if (!event) continue;
          if (event.name === "StockPurchased")
            events.push({
              name: event.name,
              assetAmount: String(event.args[1]),
              token: String(event.args[0]),
              tokenAmount: String(event.args[2]),
            });
          else events.push({ name: event.name, assetAmount: String(event.args[0]) });
        }
        if (events.length === 0)
          throw new LiveError("The confirmed transaction has no account events.", 503);
      }
    }
    return {
      status: "confirmed",
      hash,
      block: Number(hex(receipt.blockNumber)),
      confirmedAt: new Date(Number(hex(result.block.timestamp)) * 1000).toISOString(),
      deployment: deploymentHash,
      account: verified.account,
      events,
      snapshot: { ...verified, ...(await balances(owner, verified.account, block)) },
    };
  });
}
