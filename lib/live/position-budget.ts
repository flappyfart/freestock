// Micro-USDG accounting. Surplus can include direct transfers; it is not an interest ledger.
export function positionBudget(principal: bigint, value: bigint) {
  if (principal < 0n || value < 0n) throw Error("Position balances cannot be negative.");
  const surplus = value > principal ? value - principal : 0n;
  const shortfall = principal > value ? principal - value : 0n;
  const reserve = surplus > 2n ? 2n : surplus;
  return { surplus, shortfall, reserve, convertible: surplus - reserve };
}
