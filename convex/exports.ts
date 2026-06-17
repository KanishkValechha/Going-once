import { v } from 'convex/values';
import { query } from './_generated/server';
import { Id } from './_generated/dataModel';
import { requireTournamentAccess } from './lib/auth';

/**
 * A flat, render-ready summary of the finished auction for the PDF export:
 * each team with its roster (captain first, then by descending price), spend,
 * and remaining budget — plus the list of unsold players.
 */
export const auctionSummary = query({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const tournament = await ctx.db.get('tournaments', args.tournamentId);
    if (!tournament) throw new Error('Tournament not found');

    const teams = await ctx.db
      .query('teams')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', args.tournamentId))
      .take(100);
    const players = await ctx.db
      .query('players')
      .withIndex('by_tournament_and_sortOrder', (q) => q.eq('tournamentId', args.tournamentId))
      .take(500);

    const byTeam = new Map<
      Id<'teams'>,
      { name: string; role: string | null; price: number; isCaptain: boolean }[]
    >();
    for (const t of teams) byTeam.set(t._id, []);
    const unsold: { name: string; role: string | null }[] = [];
    for (const p of players) {
      if (p.status === 'sold' && p.soldToTeamId && byTeam.has(p.soldToTeamId)) {
        byTeam.get(p.soldToTeamId)!.push({
          name: p.name,
          role: p.role ?? null,
          price: p.soldPrice ?? 0,
          isCaptain: p.isCaptain,
        });
      } else if (p.status !== 'sold') {
        unsold.push({ name: p.name, role: p.role ?? null });
      }
    }

    const teamSummaries = teams
      .map((t) => {
        const roster = (byTeam.get(t._id) ?? []).sort((a, b) => {
          // Captain pinned to the top, then most expensive signings first.
          if (a.isCaptain !== b.isCaptain) return a.isCaptain ? -1 : 1;
          return b.price - a.price;
        });
        const spent = roster.reduce((sum, r) => sum + r.price, 0);
        const captain = roster.find((r) => r.isCaptain) ?? null;
        return {
          teamId: t._id,
          name: t.name,
          captainName: captain?.name ?? null,
          remainingBudget: t.remainingBudget,
          spent,
          playerCount: roster.length,
          roster,
        };
      })
      .sort((a, b) => b.spent - a.spent);

    return {
      tournamentName: tournament.name,
      rosterSize: tournament.rosterSize,
      teams: teamSummaries,
      unsold,
    };
  },
});
