import { Doc } from '../_generated/dataModel';

/**
 * Maximum a team may commit to the lot currently being bid on, while still
 * leaving enough budget to fill its remaining required roster slots at the
 * tournament's minimum bid increment (used here as the cheapest possible buy).
 *
 * remainingRequiredSlots = rosterSize - playersWon  (includes the current lot)
 * The current lot consumes one slot, so the reserve covers (slots - 1) more.
 */
export function maxAffordableBid(team: Doc<'teams'>, tournament: Doc<'tournaments'>): number {
  const remainingSlots = tournament.rosterSize - team.playersWon;
  if (remainingSlots <= 0) return 0; // roster already full
  const reserveForOtherSlots = (remainingSlots - 1) * tournament.minBidIncrement;
  return team.remainingBudget - reserveForOtherSlots;
}

/**
 * Whether `amount` is a bid this team can honor given its budget and the slots
 * it still must fill. Used as a soft warning on placeBid and a hard check on Sold.
 */
export function canTeamAfford(team: Doc<'teams'>, tournament: Doc<'tournaments'>, amount: number): boolean {
  return amount <= maxAffordableBid(team, tournament);
}
