import type { State } from "./engine.ts";

/** User-owned prizes only. Pool-wide paid prizes also include other savers. */
export function prizeSummary(state: State) {
  const claimable = state.draws.filter((draw) => draw.winner === 0 && draw.status === "claimable");
  return {
    claimable,
    readyToClaim: claimable.reduce((total, draw) => total + BigInt(draw.amount), 0n),
    claimed: Object.values(state.holdings).reduce((total, amount) => total + BigInt(amount!), 0n),
  };
}
