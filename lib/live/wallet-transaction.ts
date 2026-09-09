import { Interface } from "ethers";
import artifact from "../../contracts/artifacts/FreestockYieldAccount.artifact.json" with { type: "json" };
import { accountPlan, PILOT_STOCKS } from "./account-plan.ts";
import { USDG, ERC20_ABI } from "./config.ts";
export type WalletProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};
export type Prepared = {
  action: string;
  deployment?: string;
  owner: string;
  account: string | null;
  assets: string;
  summary: string;
  purchases?: {
    symbol: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    minimumOut: string;
    fee: number;
    weightBps: number;
    observedAt?: string;
    expiresAt?: string;
  }[];
  minimumOut: string | null;
  tokenOut: string | null;
  simulation: string;
  estimatedGasCostWei: string;
  hasGasBalance: boolean;
  canSubmit: boolean;
  expiresAt: string;
  transaction: {
    from: string;
    to?: string;
    data: string;
    value: string;
    chainId: string;
    gas?: string;
    nonce?: string;
  };
};
const accountAbi = new Interface(artifact.abi),
  tokenAbi = new Interface(ERC20_ABI);
const same = (a: unknown, b: string) =>
  typeof a === "string" && a.toLowerCase() === b.toLowerCase();
export function validatePrepared(
  plan: Prepared,
  owner: string,
  verifiedAccount: string | null,
  now = Date.now(),
) {
  const tx = plan.transaction,
    assets = BigInt(plan.assets);
  if (
    !plan.canSubmit ||
    plan.simulation !== "passed" ||
    !Number.isFinite(Date.parse(plan.expiresAt)) ||
    Date.parse(plan.expiresAt) <= now ||
    Date.parse(plan.expiresAt) > now + 60000
  )
    throw Error("Refresh this preview before approving it.");
  if (
    !same(plan.owner, owner) ||
    !same(tx.from, owner) ||
    tx.chainId !== "0x1237" ||
    tx.value !== "0x0" ||
    !/^0x[\da-f]+$/i.test(tx.nonce ?? "") ||
    !/^0x[\da-f]+$/i.test(tx.gas ?? "") ||
    BigInt(tx.gas!) <= 0n ||
    BigInt(tx.gas!) > 10_000_000n
  )
    throw Error("The transaction does not match this wallet or network.");
  if (plan.action === "deploy") {
    if (tx.to || !same(tx.data, accountPlan(owner).transaction.data))
      throw Error("Account creation data changed.");
    return;
  }
  if (!verifiedAccount || !same(plan.account, verifiedAccount))
    throw Error("Load and verify your account before continuing.");
  if (plan.action === "approve") {
    const call = tokenAbi.parseTransaction({ data: tx.data });
    if (
      !same(tx.to, USDG) ||
      call?.name !== "approve" ||
      !same(call.args[0], verifiedAccount) ||
      call.args[1] !== assets ||
      assets <= 0n ||
      assets > 100_000_000n
    )
      throw Error("Token approval does not match the reviewed amount and account.");
    return;
  }
  if (!same(tx.to, verifiedAccount)) throw Error("The transaction targets another account.");
  const call = accountAbi.parseTransaction({ data: tx.data });
  if (!call) throw Error("Unsupported transaction.");
  if (["deposit", "compound"].includes(plan.action)) {
    if (
      call.name !== plan.action ||
      call.args[0] !== assets ||
      assets <= 0n ||
      assets > 100_000_000n ||
      (plan.action === "deposit" && call.args[1] <= 0n)
    )
      throw Error("The account action differs from its preview.");
  } else if (plan.action === "withdraw") {
    if (
      call.name !== "withdrawAll" ||
      call.args[0] <= 0n ||
      call.args[0] > assets ||
      assets - call.args[0] > 2n
    )
      throw Error("Withdrawal minimum changed.");
  } else if (plan.action === "harvest") {
    const a = call.args;
    const purchases = plan.purchases ?? [];
    if (
      call.name !== "harvest" ||
      purchases.length < 1 ||
      purchases.length > 5 ||
      a[0].length !== purchases.length ||
      a[1].length !== purchases.length ||
      a[2].length !== purchases.length ||
      a[3].length !== purchases.length ||
      assets <= 0n ||
      assets > 100_000_000n ||
      a[4] !== 0n ||
      a[5] * 1000n <= BigInt(now) ||
      a[5] * 1000n > BigInt(now + 300000)
    )
      throw Error("The stock purchase differs from the reviewed route or limits.");
    const seen = new Set<string>();
    let total = 0n;
    for (const [i, p] of purchases.entries()) {
      const stock = PILOT_STOCKS.find((s) => s.symbol === p.symbol);
      if (
        !stock ||
        seen.has(stock.symbol) ||
        !same(p.tokenOut, stock.address) ||
        !same(a[0][i], stock.address) ||
        a[1][i] !== 500n ||
        p.fee !== Number(a[1][i]) ||
        a[2][i] !== BigInt(p.amountIn) ||
        a[2][i] <= 0n ||
        a[3][i] !== BigInt(p.minimumOut) ||
        a[3][i] <= 0n ||
        BigInt(p.amountOut) <= 0n ||
        (BigInt(p.amountOut) * 9900n) / 10000n !== a[3][i]
      )
        throw Error("A basket leg differs from its reviewed amount, stock or minimum.");
      seen.add(stock.symbol);
      total += a[2][i];
    }
    if (total !== assets) throw Error("Basket spending does not match the reviewed total.");
  } else throw Error("Unsupported wallet action.");
}
export async function submitPrepared(
  provider: WalletProvider,
  plan: Prepared,
  owner: string,
  account: string | null,
  beforeSend?: () => void,
) {
  validatePrepared(plan, owner, account);
  const accounts = await provider.request({ method: "eth_accounts" });
  const network = await provider.request({ method: "eth_chainId" });
  if (!Array.isArray(accounts) || !same(accounts[0], owner) || network !== "0x1237")
    throw Error("The wallet or network changed. Reconnect and refresh this preview.");
  validatePrepared(plan, owner, account);
  beforeSend?.();
  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [plan.transaction],
  });
  if (typeof hash !== "string" || !/^0x[\da-f]{64}$/i.test(hash))
    throw Error(
      "The wallet did not return a transaction hash. Check its activity before retrying.",
    );
  return hash;
}
