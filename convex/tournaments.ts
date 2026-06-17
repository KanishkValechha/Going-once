import { v } from 'convex/values';
import { mutation, query, MutationCtx } from './_generated/server';
import { Id } from './_generated/dataModel';
import { requireAdmin } from './lib/auth';

function newViewerToken(): string {
  // High-entropy capability token for the /live URL.
  return `tt_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
}

/** Ensure exactly one auctionState row exists for a tournament, in idle phase. */
async function ensureAuctionState(ctx: MutationCtx, tournamentId: Id<'tournaments'>) {
  const existing = await ctx.db
    .query('auctionState')
    .withIndex('by_tournament', (q) => q.eq('tournamentId', tournamentId))
    .unique();
  if (!existing) {
    await ctx.db.insert('auctionState', {
      tournamentId,
      bidCount: 0,
      phase: 'idle',
    });
  }
}

/** Admin-only: list tournaments the admin can manage. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query('tournaments').order('desc').take(100);
  },
});

/** Admin-only: a single tournament by id. */
export const get = query({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.get('tournaments', args.tournamentId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    defaultBudget: v.number(),
    rosterSize: v.number(),
    minBidIncrement: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const tournamentId = await ctx.db.insert('tournaments', {
      name: args.name,
      status: 'draft',
      viewerToken: newViewerToken(),
      defaultBudget: args.defaultBudget,
      rosterSize: args.rosterSize,
      minBidIncrement: args.minBidIncrement,
      createdBy: admin._id,
    });
    await ensureAuctionState(ctx, tournamentId);
    return tournamentId;
  },
});

export const update = mutation({
  args: {
    tournamentId: v.id('tournaments'),
    name: v.optional(v.string()),
    defaultBudget: v.optional(v.number()),
    rosterSize: v.optional(v.number()),
    minBidIncrement: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { tournamentId, ...patch } = args;
    const fields = Object.fromEntries(Object.entries(patch).filter(([, val]) => val !== undefined));
    await ctx.db.patch('tournaments', tournamentId, fields);
    return null;
  },
});

/** Make this tournament the single `live` one; demote any other live tournament. */
export const setLive = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const currentlyLive = await ctx.db
      .query('tournaments')
      .withIndex('by_status', (q) => q.eq('status', 'live'))
      .take(10);
    for (const t of currentlyLive) {
      if (t._id !== args.tournamentId) {
        await ctx.db.patch('tournaments', t._id, { status: 'completed' });
      }
    }
    await ctx.db.patch('tournaments', args.tournamentId, { status: 'live' });
    await ensureAuctionState(ctx, args.tournamentId);
    return null;
  },
});

export const complete = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch('tournaments', args.tournamentId, { status: 'completed' });
    return null;
  },
});

export const regenerateViewerToken = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const token = newViewerToken();
    await ctx.db.patch('tournaments', args.tournamentId, { viewerToken: token });
    return token;
  },
});
