import { getAddress, isAddress, ZeroAddress, MaxUint256 } from 'ethers';
import { LiveError } from './config.ts';
export function address(value: unknown) {
  if (
    typeof value !== 'string' ||
    !isAddress(value) ||
    value.toLowerCase() === ZeroAddress
  )
    throw new LiveError('Enter a valid public wallet address.', 400);
  return getAddress(value);
}
export function amount(value: unknown) {
  if (typeof value !== 'string' || !/^\d{1,78}(\.\d{1,6})?$/.test(value))
    throw new LiveError('Enter a USDG amount with up to six decimals.', 400);
  const [whole, frac = ''] = value.split('.');
  const n = BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, '0'));
  if (n <= 0n || n > MaxUint256)
    throw new LiveError(
      'Enter a positive USDG amount within the token’s supported range.',
      400,
    );
  return n;
}
