import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireAccessForPlayer, requireTournamentAccess, requireUser } from './lib/auth';

/** Players in a tournament (ordered), with resolved image URLs (caller must have access). */
export const listByTournament = query({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const players = await ctx.db
      .query('players')
      .withIndex('by_tournament_and_sortOrder', (q) => q.eq('tournamentId', args.tournamentId))
      .take(500);
    return await Promise.all(
      players.map(async (p) => ({
        ...p,
        imageUrl: p.imageStorageId ? await ctx.storage.getUrl(p.imageStorageId) : null,
      })),
    );
  },
});

export const create = mutation({
  args: {
    tournamentId: v.id('tournaments'),
    name: v.string(),
    role: v.optional(v.string()),
    captainMinBid: v.optional(v.number()),
    imageStorageId: v.optional(v.id('_storage')),
    isCaptain: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    // Place new players at the end of the queue.
    const last = await ctx.db
      .query('players')
      .withIndex('by_tournament_and_sortOrder', (q) => q.eq('tournamentId', args.tournamentId))
      .order('desc')
      .first();
    const sortOrder = (last?.sortOrder ?? 0) + 1;
    const isCaptain = args.isCaptain ?? false;
    return await ctx.db.insert('players', {
      tournamentId: args.tournamentId,
      name: args.name,
      role: args.role,
      // A per-captain minimum bid only applies to captains.
      captainMinBid: isCaptain ? args.captainMinBid : undefined,
      imageStorageId: args.imageStorageId,
      isCaptain,
      status: 'available',
      sortOrder,
    });
  },
});

export const update = mutation({
  args: {
    playerId: v.id('players'),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    captainMinBid: v.optional(v.number()),
    imageStorageId: v.optional(v.id('_storage')),
    isCaptain: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAccessForPlayer(ctx, args.playerId);
    const { playerId, ...patch } = args;
    const fields: Record<string, unknown> = Object.fromEntries(
      Object.entries(patch).filter(([, val]) => val !== undefined),
    );
    // A per-captain minimum bid only applies to captains: explicitly clear it
    // when a player is demoted so no stale captain bid lingers (patch removes a
    // field when set to undefined).
    if (args.isCaptain === false) fields.captainMinBid = undefined;
    await ctx.db.patch('players', playerId, fields);
    return null;
  },
});

export const remove = mutation({
  args: { playerId: v.id('players') },
  handler: async (ctx, args) => {
    await requireAccessForPlayer(ctx, args.playerId);
    const player = await ctx.db.get('players', args.playerId);
    if (!player) return null;

    // If this player is the live lot, clear the auction state — otherwise the
    // console strands on a deleted active player and the live screen shows a
    // phantom bid for a lot that no longer exists.
    const state = await ctx.db
      .query('auctionState')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', player.tournamentId))
      .unique();
    if (state?.activePlayerId === args.playerId) {
      await ctx.db.patch('auctionState', state._id, {
        activePlayerId: undefined,
        currentBid: undefined,
        leadingTeamId: undefined,
        bidCount: 0,
        phase: 'idle',
      });
    }

    // Drop this player's bid history so no orphan bids linger.
    for await (const b of ctx.db
      .query('bids')
      .withIndex('by_player_and_seq', (q) => q.eq('playerId', args.playerId))) {
      await ctx.db.delete('bids', b._id);
    }

    await ctx.db.delete('players', args.playerId);
    return null;
  },
});

/**
 * Directly assign a player to a team outside the live auction (e.g. set a
 * captain for free or a fixed price). Deducts budget atomically and marks the
 * player sold.
 */
export const directAssign = mutation({
  args: {
    playerId: v.id('players'),
    teamId: v.id('teams'),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAccessForPlayer(ctx, args.playerId);
    const player = await ctx.db.get('players', args.playerId);
    const team = await ctx.db.get('teams', args.teamId);
    if (!player) throw new Error('Player not found');
    if (!team) throw new Error('Team not found');
    if (player.status === 'sold') throw new Error('Player already sold');
    if (args.price > team.remainingBudget) throw new Error('Team cannot afford this assignment');

    await ctx.db.patch('players', args.playerId, {
      status: 'sold',
      soldToTeamId: args.teamId,
      soldPrice: args.price,
    });
    await ctx.db.patch('teams', args.teamId, {
      remainingBudget: team.remainingBudget - args.price,
      playersWon: team.playersWon + 1,
    });
    return null;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
