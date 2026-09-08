import { getAddress, isAddress, ZeroAddress } from "ethers";
import { LiveError } from "./config.ts";
export function address(value: unknown) {
  if (typeof value !== "string" || !isAddress(value) || value.toLowerCase() === ZeroAddress)
    throw new LiveError("Enter a valid public wallet address.", 400);
  return getAddress(value);
}
export function amount(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,6}(\.\d{1,6})?$/.test(value))
    throw new LiveError("Enter a USDG amount with up to six decimals.", 400);
  const [whole, frac = ""] = value.split(".");
  const n = BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, "0"));
  if (n <= 0n || n > 100_000_000n)
    throw new LiveError("This integration check supports amounts up to 100 USDG.", 400);
  return n;
}
