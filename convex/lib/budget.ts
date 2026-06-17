import { Doc } from '../_generated/dataModel';

// Fallback for tournaments created before the tournament-wide minimum bid
// existed (the field is optional in the schema).
export const DEFAULT_MIN_BID = 100;

/** The tournament-wide minimum/opening bid for a regular (non-captain) player. */
export function baseMinBid(tournament: Doc<'tournaments'>): number {
  return tournament.minBid ?? DEFAULT_MIN_BID;
}

/**
 * The opening/minimum bid for a specific player: a captain uses its own
 * `captainMinBid` (falling back to the tournament floor if unset), everyone else
 * uses the tournament-wide `minBid`. There is no per-player base price.
 */
export function playerMinBid(tournament: Doc<'tournaments'>, player: Doc<'players'>): number {
  if (player.isCaptain) return player.captainMinBid ?? baseMinBid(tournament);
  return baseMinBid(tournament);
}

/**
 * Maximum a team may commit to the lot currently being bid on, while still
 * leaving enough budget to fill its remaining required roster slots at the
 * tournament's minimum bid (the cheapest possible buy).
 *
 * remainingRequiredSlots = rosterSize - playersWon  (includes the current lot)
 * The current lot consumes one slot, so the reserve covers (slots - 1) more.
 */
export function maxAffordableBid(team: Doc<'teams'>, tournament: Doc<'tournaments'>): number {
  const remainingSlots = tournament.rosterSize - team.playersWon;
  if (remainingSlots <= 0) return 0; // roster already full
  const reserveForOtherSlots = (remainingSlots - 1) * baseMinBid(tournament);
  return team.remainingBudget - reserveForOtherSlots;
}

/**
 * Whether `amount` is a bid this team can honor given its budget and the slots
 * it still must fill. Used as a soft warning on placeBid and a hard check on Sold.
 */
export function canTeamAfford(team: Doc<'teams'>, tournament: Doc<'tournaments'>, amount: number): boolean {
  return amount <= maxAffordableBid(team, tournament);
}

/**
 * Graduated balance flag for a team during the auction:
 *   'out' — can't bid any further (roster full or no headroom left)
 *   'low' — closing in on its limit (room for only a couple more min-bids)
 *   'ok'  — comfortable headroom.
 */
export function budgetStatus(team: Doc<'teams'>, tournament: Doc<'tournaments'>): 'ok' | 'low' | 'out' {
  if (team.playersWon >= tournament.rosterSize) return 'out';
  const max = maxAffordableBid(team, tournament);
  if (max <= 0) return 'out';
  if (max < baseMinBid(tournament) * 3) return 'low';
  return 'ok';
}
