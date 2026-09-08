export const CHAIN_ID = 4663;
export const RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const EXPLORER_URL = "https://robinhoodchain.blockscout.com";
export const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
export const VAULT = "0xBeEff033F34C046626B8D0A041844C5d1A5409dd";
export const STOCK_TOKENS = [
  { symbol: "NVDA", address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC" },
  { symbol: "AAPL", address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9" },
  { symbol: "MSFT", address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74" },
  { symbol: "TSLA", address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d" },
  { symbol: "GOOGL", address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3" },
  { symbol: "SPY", address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C" },
] as const;
export const ERC20_ABI = [
  "function balanceOf(address) view returns(uint256)",
  "function decimals() view returns(uint8)",
  "function allowance(address,address) view returns(uint256)",
  "function approve(address,uint256) returns(bool)",
];
export const VAULT_ABI = [
  "function asset() view returns(address)",
  "function decimals() view returns(uint8)",
  "function balanceOf(address) view returns(uint256)",
  "function previewDeposit(uint256) view returns(uint256)",
  "function previewRedeem(uint256) view returns(uint256)",
  "function deposit(uint256,address) returns(uint256)",
  "function redeem(uint256,address,address) returns(uint256)",
  "function sendAssetsGate() view returns(address)",
  "function receiveSharesGate() view returns(address)",
  "function sendSharesGate() view returns(address)",
  "function receiveAssetsGate() view returns(address)",
];
export class LiveError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}
