import { v } from 'convex/values';
import { mutation, query, QueryCtx, MutationCtx } from './_generated/server';
import { Id } from './_generated/dataModel';
import { requireAdmin } from './lib/auth';
import { canTeamAfford, maxAffordableBid } from './lib/budget';
import { nextBid } from './lib/increment';

/** Resolve a `live` tournament from a viewer token, or null if invalid/inactive. */
async function resolveViewer(ctx: QueryCtx, token: string) {
  if (!token) return null;
  const tournament = await ctx.db
    .query('tournaments')
    .withIndex('by_viewerToken', (q) => q.eq('viewerToken', token))
    .unique();
  if (!tournament || tournament.status !== 'live') return null;
  return tournament;
}

async function getState(ctx: QueryCtx | MutationCtx, tournamentId: Id<'tournaments'>) {
  return await ctx.db
    .query('auctionState')
    .withIndex('by_tournament', (q) => q.eq('tournamentId', tournamentId))
    .unique();
}

async function requireState(ctx: MutationCtx, tournamentId: Id<'tournaments'>) {
  const state = await getState(ctx, tournamentId);
  if (!state) throw new Error('Auction state not initialized for this tournament');
  return state;
}

// ---------------------------------------------------------------------------
// Admin: auction control console
// ---------------------------------------------------------------------------

/** Put a player into active bidding. Rejected if a lot is already live. */
export const selectPlayer = mutation({
  args: { tournamentId: v.id('tournaments'), playerId: v.id('players') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const state = await requireState(ctx, args.tournamentId);
    if (state.phase === 'bidding') throw new Error('Finish the current lot before selecting another');
    const player = await ctx.db.get('players', args.playerId);
    if (!player || player.tournamentId !== args.tournamentId) throw new Error('Player not found');
    if (player.status === 'sold') throw new Error('Player already sold');

    await ctx.db.patch('auctionState', state._id, {
      activePlayerId: args.playerId,
      currentBid: undefined,
      leadingTeamId: undefined,
      bidCount: 0,
      phase: 'bidding',
    });
    return null;
  },
});

/**
 * Register a bid for a team. The amount is computed server-side (never trusted
 * from the client). `expectedBidCount` guards against double-fired clicks: if it
 * doesn't match the current count, the call is a no-op. Only `auctionState` and
 * an appended `bids` row are written — the hot path never touches teams/players.
 */
export const placeBid = mutation({
  args: {
    tournamentId: v.id('tournaments'),
    teamId: v.id('teams'),
    overrideAmount: v.optional(v.number()),
    expectedBidCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const state = await requireState(ctx, args.tournamentId);
    if (state.phase !== 'bidding' || !state.activePlayerId) {
      throw new Error('No active lot to bid on');
    }
    // Idempotency guard: a stale/duplicate click is silently ignored.
    if (args.expectedBidCount !== undefined && args.expectedBidCount !== state.bidCount) {
      return { ignored: true as const, currentBid: state.currentBid, bidCount: state.bidCount };
    }

    const player = await ctx.db.get('players', state.activePlayerId);
    if (!player) throw new Error('Active player missing');
    const tournament = await ctx.db.get('tournaments', args.tournamentId);
    if (!tournament) throw new Error('Tournament missing');

    let amount: number;
    if (args.overrideAmount !== undefined) {
      const floor = state.currentBid ?? player.basePrice;
      if (state.currentBid === undefined ? args.overrideAmount < floor : args.overrideAmount <= floor) {
        throw new Error('Override must exceed the current bid');
      }
      amount = args.overrideAmount;
    } else {
      amount = nextBid(state.currentBid, player.basePrice, tournament.minBidIncrement);
    }

    const newBidCount = state.bidCount + 1;
    await ctx.db.patch('auctionState', state._id, {
      currentBid: amount,
      leadingTeamId: args.teamId,
      bidCount: newBidCount,
    });
    await ctx.db.insert('bids', {
      tournamentId: args.tournamentId,
      playerId: state.activePlayerId,
      teamId: args.teamId,
      amount,
      seq: newBidCount,
      undone: false,
    });

    // Soft affordability signal (advisory; Sold enforces the hard limit).
    const team = await ctx.db.get('teams', args.teamId);
    const affordWarning = team ? !canTeamAfford(team, tournament, amount) : false;
    return { ignored: false as const, currentBid: amount, bidCount: newBidCount, affordWarning };
  },
});

/** Undo the most recent (non-undone) bid on the active lot. */
export const undoBid = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const state = await requireState(ctx, args.tournamentId);
    if (state.phase !== 'bidding' || !state.activePlayerId) return null;

    const playerId = state.activePlayerId;
    let toUndo: Id<'bids'> | null = null;
    let newLeaderAmount: number | undefined = undefined;
    let newLeaderTeam: Id<'teams'> | undefined = undefined;
    for await (const b of ctx.db
      .query('bids')
      .withIndex('by_player_and_seq', (q) => q.eq('playerId', playerId))
      .order('desc')) {
      if (b.undone) continue;
      if (toUndo === null) {
        toUndo = b._id;
        continue;
      }
      newLeaderAmount = b.amount;
      newLeaderTeam = b.teamId;
      break;
    }
    if (toUndo === null) return null;

    await ctx.db.patch('bids', toUndo, { undone: true });
    await ctx.db.patch('auctionState', state._id, {
      currentBid: newLeaderAmount,
      leadingTeamId: newLeaderTeam,
    });
    return null;
  },
});

/** Sell the active lot to the leading team. Atomically deducts budget and enforces the hard cap. */
export const markSold = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const state = await requireState(ctx, args.tournamentId);
    if (state.phase !== 'bidding' || !state.activePlayerId) throw new Error('No active lot');
    if (!state.leadingTeamId || state.currentBid === undefined) {
      throw new Error('No bids placed — mark unsold instead');
    }

    const player = await ctx.db.get('players', state.activePlayerId);
    const team = await ctx.db.get('teams', state.leadingTeamId);
    const tournament = await ctx.db.get('tournaments', args.tournamentId);
    if (!player || !team || !tournament) throw new Error('Auction data missing');
    if (!canTeamAfford(team, tournament, state.currentBid)) {
      throw new Error('Winning team cannot afford this bid given its remaining roster slots');
    }

    await ctx.db.patch('players', player._id, {
      status: 'sold',
      soldToTeamId: team._id,
      soldPrice: state.currentBid,
    });
    await ctx.db.patch('teams', team._id, {
      remainingBudget: team.remainingBudget - state.currentBid,
      playersWon: team.playersWon + 1,
    });
    await ctx.db.patch('auctionState', state._id, {
      activePlayerId: undefined,
      currentBid: undefined,
      leadingTeamId: undefined,
      bidCount: 0,
      phase: 'idle',
    });
    return null;
  },
});

/** Mark the active lot unsold and clear the floor so it can be re-auctioned later. */
export const markUnsold = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const state = await requireState(ctx, args.tournamentId);
    if (state.phase !== 'bidding' || !state.activePlayerId) throw new Error('No active lot');
    await ctx.db.patch('players', state.activePlayerId, { status: 'unsold' });
    await ctx.db.patch('auctionState', state._id, {
      activePlayerId: undefined,
      currentBid: undefined,
      leadingTeamId: undefined,
      bidCount: 0,
      phase: 'idle',
    });
    return null;
  },
});

/** Reverse a completed sale: refund the team and return the player to the pool. */
export const undoSold = mutation({
  args: { tournamentId: v.id('tournaments'), playerId: v.id('players') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const player = await ctx.db.get('players', args.playerId);
    if (!player || player.tournamentId !== args.tournamentId) throw new Error('Player not found');
    if (player.status !== 'sold' || !player.soldToTeamId || player.soldPrice === undefined) {
      throw new Error('Player is not sold');
    }
    const team = await ctx.db.get('teams', player.soldToTeamId);
    if (team) {
      await ctx.db.patch('teams', team._id, {
        remainingBudget: team.remainingBudget + player.soldPrice,
        playersWon: Math.max(0, team.playersWon - 1),
      });
    }
    await ctx.db.patch('players', player._id, {
      status: 'available',
      soldToTeamId: undefined,
      soldPrice: undefined,
    });
    return null;
  },
});

/** Admin console state: active lot, leading team, and per-team affordability. */
export const consoleState = query({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const tournament = await ctx.db.get('tournaments', args.tournamentId);
    if (!tournament) return null;
    const state = await getState(ctx, args.tournamentId);

    const teams = await ctx.db
      .query('teams')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', args.tournamentId))
      .take(100);

    let activePlayer = null;
    if (state?.activePlayerId) {
      const p = await ctx.db.get('players', state.activePlayerId);
      if (p) {
        activePlayer = {
          ...p,
          imageUrl: p.imageStorageId ? await ctx.storage.getUrl(p.imageStorageId) : null,
        };
      }
    }

    return {
      tournament,
      phase: state?.phase ?? 'idle',
      currentBid: state?.currentBid ?? null,
      leadingTeamId: state?.leadingTeamId ?? null,
      bidCount: state?.bidCount ?? 0,
      activePlayer,
      teams: teams.map((t) => ({
        ...t,
        maxBid: maxAffordableBid(t, tournament),
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Public viewer queries (token-gated, no WorkOS auth)
// ---------------------------------------------------------------------------

/**
 * Tiny, high-frequency subscription for the live screen's active panel. Only
 * this query re-fires on every bid, keeping the per-click payload small.
 */
export const liveTicker = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tournament = await resolveViewer(ctx, args.token);
    if (!tournament) return { phase: 'invalid' as const };
    const state = await getState(ctx, tournament._id);
    if (!state || state.phase !== 'bidding' || !state.activePlayerId) {
      return { phase: 'idle' as const };
    }
    const player = await ctx.db.get('players', state.activePlayerId);
    const leadingTeam = state.leadingTeamId ? await ctx.db.get('teams', state.leadingTeamId) : null;
    return {
      phase: 'bidding' as const,
      currentBid: state.currentBid ?? null,
      player: player
        ? {
            name: player.name,
            role: player.role ?? null,
            basePrice: player.basePrice,
            imageUrl: player.imageStorageId ? await ctx.storage.getUrl(player.imageStorageId) : null,
          }
        : null,
      leadingTeam: leadingTeam
        ? {
            name: leadingTeam.name,
            logoUrl: leadingTeam.logoStorageId ? await ctx.storage.getUrl(leadingTeam.logoStorageId) : null,
          }
        : null,
    };
  },
});

/**
 * Team standings board. Re-fires only when teams/players change (Sold/Unsold),
 * not on every bid.
 */
export const liveBoard = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tournament = await resolveViewer(ctx, args.token);
    if (!tournament) return { valid: false as const };
    const teams = await ctx.db
      .query('teams')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', tournament._id))
      .take(100);
    return {
      valid: true as const,
      tournamentName: tournament.name,
      rosterSize: tournament.rosterSize,
      teams: await Promise.all(
        teams.map(async (t) => ({
          _id: t._id,
          name: t.name,
          remainingBudget: t.remainingBudget,
          playersWon: t.playersWon,
          logoUrl: t.logoStorageId ? await ctx.storage.getUrl(t.logoStorageId) : null,
        })),
      ),
    };
  },
});
