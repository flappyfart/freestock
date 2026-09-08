/** Homepage illustration only; does not configure funded practice draws. */
export const EXAMPLE_POOLS = [100_000, 1_000_000, 10_000_000] as const;
export type ExamplePool = (typeof EXAMPLE_POOLS)[number];
export function prizeProjection(pool: ExamplePool) {
  return {
    weeklyPrize: Math.floor((pool * 4 * 90 * 7) / (100 * 100 * 365)),
    oneInOdds: pool / 100,
  };
}
