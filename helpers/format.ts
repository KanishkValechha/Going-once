/** Format an auction amount/budget with thousands separators. */
export function formatAmount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

/** Remaining required roster slots for a team. */
export function remainingSlots(rosterSize: number, playersWon: number): number {
  return Math.max(0, rosterSize - playersWon);
}
