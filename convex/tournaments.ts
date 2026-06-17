import { v } from 'convex/values';
import { mutation, query, MutationCtx, QueryCtx } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import { requireTournamentAccess, requireUser } from './lib/auth';
import { upsertUserByEmail } from './users';

function newViewerToken(): string {
  // High-entropy capability token for the /live URL.
  return `tt_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`;
}

/**
 * How many teams/players a tournament has versus the minimum needed to run a
 * fair auction: every team must be able to fill its full roster, so we need at
 * least `rosterSize * teamCount` players (and at least two competing teams).
 */
async function computeReadiness(ctx: QueryCtx | MutationCtx, tournamentId: Id<'tournaments'>) {
  const tournament = await ctx.db.get('tournaments', tournamentId);
  if (!tournament) throw new Error('Tournament not found');
  const teams = await ctx.db
    .query('teams')
    .withIndex('by_tournament', (q) => q.eq('tournamentId', tournamentId))
    .take(100);
  const players = await ctx.db
    .query('players')
    .withIndex('by_tournament_and_sortOrder', (q) => q.eq('tournamentId', tournamentId))
    .take(1000);
  const teamCount = teams.length;
  const playerCount = players.length;
  const requiredPlayers = tournament.rosterSize * teamCount;
  const enoughTeams = teamCount >= 2;
  const enoughPlayers = playerCount >= requiredPlayers;
  return {
    teamCount,
    playerCount,
    requiredPlayers,
    rosterSize: tournament.rosterSize,
    enoughTeams,
    enoughPlayers,
    ready: enoughTeams && enoughPlayers,
  };
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

/**
 * Reset a tournament's auction to a clean idle slate (creating the row if it's
 * missing). Called when going live so a lot left mid-bid in a prior session
 * never carries over — sold players and team budgets, which live on their own
 * rows, are untouched.
 */
async function resetAuctionState(ctx: MutationCtx, tournamentId: Id<'tournaments'>) {
  const existing = await ctx.db
    .query('auctionState')
    .withIndex('by_tournament', (q) => q.eq('tournamentId', tournamentId))
    .unique();
  if (existing) {
    await ctx.db.patch('auctionState', existing._id, {
      activePlayerId: undefined,
      currentBid: undefined,
      leadingTeamId: undefined,
      bidCount: 0,
      phase: 'idle',
    });
  } else {
    await ctx.db.insert('auctionState', { tournamentId, bidCount: 0, phase: 'idle' });
  }
}

/**
 * List the tournaments the caller can manage: super-admins see all, members see
 * only the ones they belong to.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user.role === 'admin') {
      return await ctx.db.query('tournaments').order('desc').take(100);
    }
    const memberships = await ctx.db
      .query('tournamentMembers')
      .withIndex('by_user_and_tournament', (q) => q.eq('userId', user._id))
      .take(100);
    const tournaments = await Promise.all(
      memberships.map((m) => ctx.db.get('tournaments', m.tournamentId)),
    );
    return tournaments
      .filter((t): t is Doc<'tournaments'> => t !== null)
      .sort((a, b) => b._creationTime - a._creationTime);
  },
});

/** A single tournament by id (caller must have access). */
export const get = query({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    return await ctx.db.get('tournaments', args.tournamentId);
  },
});

// Sensible starting points so a new tournament can be created from just a name,
// then fine-tuned in its setup screen.
const DEFAULTS = {
  defaultBudget: 10000,
  rosterSize: 11,
  minBidIncrement: 100,
  minBid: 100,
} as const;

export const create = mutation({
  args: {
    name: v.string(),
    defaultBudget: v.optional(v.number()),
    rosterSize: v.optional(v.number()),
    minBidIncrement: v.optional(v.number()),
    minBid: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const tournamentId = await ctx.db.insert('tournaments', {
      name: args.name,
      status: 'draft',
      viewerToken: newViewerToken(),
      defaultBudget: args.defaultBudget ?? DEFAULTS.defaultBudget,
      rosterSize: args.rosterSize ?? DEFAULTS.rosterSize,
      minBidIncrement: args.minBidIncrement ?? DEFAULTS.minBidIncrement,
      minBid: args.minBid ?? DEFAULTS.minBid,
      createdBy: user._id,
    });
    await ensureAuctionState(ctx, tournamentId);
    // The creator becomes a member so they can see/edit what they created.
    await ctx.db.insert('tournamentMembers', {
      tournamentId,
      userId: user._id,
      addedBy: user._id,
    });
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
    minBid: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const { tournamentId, ...patch } = args;
    const fields = Object.fromEntries(Object.entries(patch).filter(([, val]) => val !== undefined));
    await ctx.db.patch('tournaments', tournamentId, fields);
    return null;
  },
});

/** Readiness check for going live: team/player counts vs the roster minimum. */
export const liveReadiness = query({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    return await computeReadiness(ctx, args.tournamentId);
  },
});

/** Make this tournament the single `live` one; demote any other live tournament. */
export const setLive = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const readiness = await computeReadiness(ctx, args.tournamentId);
    if (!readiness.enoughTeams) {
      throw new Error('Add at least two teams before going live');
    }
    if (!readiness.enoughPlayers) {
      throw new Error(
        `Not enough players: ${readiness.playerCount}/${readiness.requiredPlayers} needed ` +
          `(roster ${readiness.rosterSize} × ${readiness.teamCount} teams)`,
      );
    }
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
    await resetAuctionState(ctx, args.tournamentId);
    return null;
  },
});

export const complete = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    await ctx.db.patch('tournaments', args.tournamentId, { status: 'completed' });
    return null;
  },
});

export const regenerateViewerToken = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const token = newViewerToken();
    await ctx.db.patch('tournaments', args.tournamentId, { viewerToken: token });
    return token;
  },
});

// ---------------------------------------------------------------------------
// Tournament membership — who can see/edit this tournament
// ---------------------------------------------------------------------------

/** List the members of a tournament (caller must have access). */
export const listMembers = query({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const memberships = await ctx.db
      .query('tournamentMembers')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', args.tournamentId))
      .take(200);
    const tournament = await ctx.db.get('tournaments', args.tournamentId);
    return await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get('users', m.userId);
        return {
          membershipId: m._id,
          userId: m.userId,
          email: user?.email ?? '(removed)',
          name: user?.name ?? null,
          role: user?.role ?? 'member',
          pending: user ? !user.tokenIdentifier : false,
          isCreator: tournament?.createdBy === m.userId,
        };
      }),
    );
  },
});

/**
 * Add a member to a tournament by email so they can edit it. Anyone with access
 * to the tournament (super-admin or an existing member) may add others. If the
 * email isn't a portal user yet it's invited as a `member` (granting login).
 */
export const addMember = mutation({
  args: { tournamentId: v.id('tournaments'), email: v.string() },
  handler: async (ctx, args) => {
    const caller = await requireTournamentAccess(ctx, args.tournamentId);
    const userId = await upsertUserByEmail(ctx, args.email, 'member', caller._id);
    const existing = await ctx.db
      .query('tournamentMembers')
      .withIndex('by_user_and_tournament', (q) =>
        q.eq('userId', userId).eq('tournamentId', args.tournamentId),
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert('tournamentMembers', {
      tournamentId: args.tournamentId,
      userId,
      addedBy: caller._id,
    });
  },
});

/** Remove a member from a tournament (caller must have access). */
export const removeMember = mutation({
  args: { tournamentId: v.id('tournaments'), userId: v.id('users') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const tournament = await ctx.db.get('tournaments', args.tournamentId);
    if (tournament?.createdBy === args.userId) {
      throw new Error('The tournament creator cannot be removed');
    }
    const membership = await ctx.db
      .query('tournamentMembers')
      .withIndex('by_user_and_tournament', (q) =>
        q.eq('userId', args.userId).eq('tournamentId', args.tournamentId),
      )
      .unique();
    if (membership) await ctx.db.delete('tournamentMembers', membership._id);
    return null;
  },
});
