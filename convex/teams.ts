import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireAdmin } from './lib/auth';

/** Admin-only: teams in a tournament, with resolved logo URLs. */
export const listByTournament = query({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const teams = await ctx.db
      .query('teams')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', args.tournamentId))
      .take(100);
    return await Promise.all(
      teams.map(async (t) => ({
        ...t,
        logoUrl: t.logoStorageId ? await ctx.storage.getUrl(t.logoStorageId) : null,
      })),
    );
  },
});

export const create = mutation({
  args: {
    tournamentId: v.id('tournaments'),
    name: v.string(),
    logoStorageId: v.optional(v.id('_storage')),
    budget: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const tournament = await ctx.db.get('tournaments', args.tournamentId);
    if (!tournament) throw new Error('Tournament not found');
    return await ctx.db.insert('teams', {
      tournamentId: args.tournamentId,
      name: args.name,
      logoStorageId: args.logoStorageId,
      remainingBudget: args.budget ?? tournament.defaultBudget,
      playersWon: 0,
    });
  },
});

export const update = mutation({
  args: {
    teamId: v.id('teams'),
    name: v.optional(v.string()),
    logoStorageId: v.optional(v.id('_storage')),
    remainingBudget: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { teamId, ...patch } = args;
    const fields = Object.fromEntries(Object.entries(patch).filter(([, val]) => val !== undefined));
    await ctx.db.patch('teams', teamId, fields);
    return null;
  },
});

export const remove = mutation({
  args: { teamId: v.id('teams') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete('teams', args.teamId);
    return null;
  },
});

/** Upload URL for a team logo (admin-only). Client POSTs the file, gets a storageId. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
