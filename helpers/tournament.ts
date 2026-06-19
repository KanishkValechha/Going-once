import type { TournamentFormat, TournamentPhase } from '@/types';

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  single_elimination: 'Single Elimination',
  round_robin: 'Round Robin',
  double_round_robin: 'Double Round Robin',
  groups_knockout: 'Groups + Knockout',
};

export const FORMAT_DESC: Record<TournamentFormat, string> = {
  round_robin: 'Everyone plays everyone once.',
  double_round_robin: 'Home & away — twice each.',
  single_elimination: 'Win or go home bracket.',
  groups_knockout: 'Group stage then finals.',
};

export const FORMAT_ORDER: TournamentFormat[] = [
  'round_robin',
  'double_round_robin',
  'single_elimination',
  'groups_knockout',
];

export type Progress = {
  teamCount: number;
  playerCount: number;
  soldCount: number;
  poolCount: number;
  unsoldCount: number;
  spent: number;
  matchCount: number;
  playableCount: number;
  finalsCount: number;
};

/**
 * The lifecycle stage a tournament is actually in, derived from its progress.
 * Richer than the stored draft/live/completed status — it reads "where are we
 * in running this competition", which is what the portal surfaces.
 */
export function derivePhase(p: Progress): TournamentPhase {
  if (p.playableCount > 0 && p.finalsCount === p.playableCount) return 'completed';
  if (p.matchCount > 0) return 'live';
  if (p.soldCount > 0 || (p.playerCount > 0 && p.poolCount === 0)) return 'auction';
  return 'setup';
}

export const PHASE_LABEL: Record<TournamentPhase, string> = {
  setup: 'Setup',
  auction: 'Auction',
  live: 'Live',
  completed: 'Done',
};

/** Badge variant for a derived phase. */
export const PHASE_VARIANT: Record<TournamentPhase, 'neutral' | 'accent' | 'live' | 'positive'> = {
  setup: 'neutral',
  auction: 'accent',
  live: 'live',
  completed: 'positive',
};
