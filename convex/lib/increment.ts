/**
 * Dynamic bid step: larger increments at higher price points. `minIncrement`
 * is the tournament floor and the step never drops below it. Pure (no ctx) so
 * it can be unit-tested and mirrored on the client for display.
 */
export function computeStep(currentBid: number, minIncrement: number): number {
  if (currentBid < 100) return minIncrement;
  if (currentBid < 500) return Math.max(minIncrement, 25);
  if (currentBid < 2000) return Math.max(minIncrement, 50);
  return Math.max(minIncrement, 100);
}

/**
 * Next automatic bid amount. The opening bid (no current bid yet) sits at the
 * player's base price; subsequent bids add the dynamic step.
 */
export function nextBid(currentBid: number | undefined, basePrice: number, minIncrement: number): number {
  if (currentBid === undefined) return basePrice;
  return currentBid + computeStep(currentBid, minIncrement);
}
