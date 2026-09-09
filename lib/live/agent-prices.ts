import { Interface } from 'ethers';
import { pin, read, rpc, withRpcReads } from './chain';
import { estimateCosts } from './agent-settings';
import type { Prepared } from './wallet-transaction';

// Chainlink's Robinhood mainnet directory, verified 2026-09-09 against proxy getters.
// https://reference-data-directory.vercel.app/feeds-robinhood-mainnet.json
export const COST_FEEDS = [
  {
    name: 'ETH / USD',
    address: '0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9',
    heartbeat: 86400,
  },
  {
    name: 'USDG / USD',
    address: '0x61B7e5650328764B076A108EFF5fa7282a1B9aD2',
    heartbeat: 86400,
  },
] as const;
const feed = new Interface([
  'function decimals() view returns(uint8)',
  'function description() view returns(string)',
  'function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)',
]);
export async function quoteAgentCosts(prepared: Prepared) {
  return withRpcReads(async () => {
    const now = Date.now(),
      block = await pin();
    const header = (await rpc('eth_getBlockByNumber', [block, false])) as {
      hash: string;
      timestamp: string;
    };
    const timestamp = Number(BigInt(header.timestamp));
    if (
      !Number.isSafeInteger(timestamp) ||
      timestamp * 1000 > now + 5000 ||
      now - timestamp * 1000 > 45000
    )
      throw Error('Recent chain data is unavailable.');
    const prices = await Promise.all(
      COST_FEEDS.map(async (config) => {
        const [round, decimals, description] = await Promise.all([
          read(config.address, feed, 'latestRoundData', [], block),
          read(config.address, feed, 'decimals', [], block),
          read(config.address, feed, 'description', [], block),
        ]);
        const price = BigInt(String(round[1])),
          updatedAt = Number(round[3]),
          scale = Number(decimals[0]);
        if (
          String(description[0]) !== config.name ||
          price <= 0n ||
          !Number.isSafeInteger(updatedAt) ||
          updatedAt <= 0 ||
          updatedAt > timestamp ||
          timestamp - updatedAt > config.heartbeat ||
          BigInt(String(round[0])) === 0n ||
          BigInt(String(round[4])) < BigInt(String(round[0])) ||
          !Number.isInteger(scale) ||
          scale < 0 ||
          scale > 18
        )
          throw Error(
            'A price feed is unavailable or outside its published freshness window.',
          );
        return { price, updatedAt, scale };
      }),
    );
    const end = (await rpc('eth_getBlockByNumber', [block, false])) as {
      hash: string;
    };
    if (end.hash !== header.hash) throw Error('The price snapshot changed.');
    const assets = BigInt(prepared.assets);
    let fees = 0n,
      sum = 0n;
    for (const p of prepared.purchases ?? []) {
      const amount = BigInt(p.amountIn);
      if (!Number.isInteger(p.fee) || p.fee < 0 || p.fee >= 1_000_000)
        throw Error('Unknown stock pool fee.');
      sum += amount;
      fees += (amount * BigInt(p.fee) + 999999n) / 1000000n;
    }
    if (sum !== assets || assets <= 0n)
      throw Error('The cost estimate does not match the purchase.');
    return estimateCosts({
      gasWei: BigInt(prepared.estimatedGasCostWei),
      assets,
      poolFees: fees,
      ethPrice: prices[0].price,
      usdgPrice: prices[1].price,
      ethDecimals: prices[0].scale,
      usdgDecimals: prices[1].scale,
      now,
      ethUpdatedAt: prices[0].updatedAt,
      usdgUpdatedAt: prices[1].updatedAt,
    });
  });
}
