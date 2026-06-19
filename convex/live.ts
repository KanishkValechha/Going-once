import { v } from 'convex/values';
import { query, QueryCtx } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import { resolveViewer } from './lib/viewer';
import { buildBracketView, computeStandings } from './bracket';

/**
 * Public, token-gated lifecycle for the live client. Derives which stage a
 * tournament is in so the viewer screen can switch between the auction, the
 * matches/leaderboard, and the final champion — and keep showing results until
 * the event is closed. Mirrors the admin-side derivation; no auth required.
 */

type Phase = 'auction' | 'matches' | 'completed' | 'invalid';

/** Champion name once a tournament is complete, else null. */
function computeChampion(
  format: Doc<'brackets'>['format'],
  matches: Doc<'matches'>[],
  teamById: Map<Id<'teams'>, Doc<'teams'>>,
): string | null {
  const nameOf = (id?: Id<'teams'>) => (id ? (teamById.get(id)?.name ?? null) : null);
  if (format === 'round_robin' || format === 'double_round_robin') {
    const group = matches.filter((m) => m.stage === 'group');
    const teamIds = [
      ...new Set(group.flatMap((m) => [m.teamAId, m.teamBId].filter(Boolean) as Id<'teams'>[])),
    ];
    const table = computeStandings(teamIds, group);
    return table.length > 0 && table[0].played > 0 ? nameOf(table[0].teamId) : null;
  }
  // Knockout & groups+knockout: the final is the highest-round knockout match.
  const knockout = matches.filter((m) => m.stage === 'knockout');
  if (knockout.length === 0) return null;
  const maxRound = Math.max(...knockout.map((m) => m.round));
  const final = knockout.find((m) => m.round === maxRound);
  return final?.status === 'done' ? nameOf(final.winnerTeamId) : null;
}

async function loadMatches(ctx: QueryCtx, tournamentId: Id<'tournaments'>) {
  return await ctx.db
    .query('matches')
    .withIndex('by_tournament', (q) => q.eq('tournamentId', tournamentId))
    .take(2000);
}

/**
 * Which stage the live client should render, plus the tournament name and (when
 * finished) the champion. A bracket whose playable matches are all done is
 * `completed`; any bracket/matches at all is `matches`; otherwise `auction`.
 */
export const phase = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tournament = await resolveViewer(ctx, args.token);
    if (!tournament) return { phase: 'invalid' as Phase };

    const matches = await loadMatches(ctx, tournament._id);
    const playable = matches.filter((m) => m.teamAId && m.teamBId);
    const done = playable.filter((m) => m.status === 'done').length;

    let phase: Phase = 'auction';
    if (playable.length > 0 && done === playable.length) phase = 'completed';
    else if (matches.length > 0) phase = 'matches';

    let champion: string | null = null;
    if (phase === 'completed') {
      const bracket = await ctx.db
        .query('brackets')
        .withIndex('by_tournament', (q) => q.eq('tournamentId', tournament._id))
        .unique();
      if (bracket) {
        const teams = await ctx.db
          .query('teams')
          .withIndex('by_tournament', (q) => q.eq('tournamentId', tournament._id))
          .take(100);
        champion = computeChampion(bracket.format, matches, new Map(teams.map((t) => [t._id, t])));
      }
    }

    return {
      phase,
      tournamentName: tournament.name,
      status: tournament.status,
      champion,
    };
  },
});

/**
 * Token-gated equivalent of `bracket.view` — enriched matches and league/group
 * standings for the live client's Matches and Table tabs.
 */
export const bracket = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tournament = await resolveViewer(ctx, args.token);
    if (!tournament) return { valid: false as const };
    const data = await buildBracketView(ctx, tournament._id);
    if (!data) return { valid: true as const, bracket: null };
    return { valid: true as const, ...data };
  },
});
