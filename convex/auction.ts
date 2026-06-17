import { v } from 'convex/values';
import { mutation, query, QueryCtx, MutationCtx } from './_generated/server';
import { Id } from './_generated/dataModel';
import { requireTournamentAccess } from './lib/auth';
import { budgetStatus, canTeamAfford, maxAffordableBid, playerMinBid } from './lib/budget';
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

type AuctionState = NonNullable<Awaited<ReturnType<typeof getState>>>;

/**
 * Resolve the player genuinely on the block. The invariant we enforce here is
 * `phase === 'bidding'` ⟺ a real, still-existing active player. If a lot was
 * left mid-bid in a prior session, or the active player was deleted out from
 * under the state, `activePlayerId` may dangle — in that case the auction is
 * treated as idle so a stale row can never strand the console or show a phantom
 * bid on the live screen.
 */
async function activeLot(ctx: QueryCtx | MutationCtx, state: AuctionState) {
  if (state.phase !== 'bidding' || !state.activePlayerId) return null;
  return await ctx.db.get('players', state.activePlayerId);
}

// ---------------------------------------------------------------------------
// Admin: auction control console
// ---------------------------------------------------------------------------

/** Put a player into active bidding. Rejected if a lot is already live. */
export const selectPlayer = mutation({
  args: { tournamentId: v.id('tournaments'), playerId: v.id('players') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const state = await requireState(ctx, args.tournamentId);
    if (await activeLot(ctx, state)) throw new Error('Finish the current lot before selecting another');
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
 * Put a randomly chosen available player into active bidding — the auctioneer
 * reveals players one by one without picking the order. Rejected if a lot is
 * already live or no available players remain.
 */
export const selectRandomPlayer = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const state = await requireState(ctx, args.tournamentId);
    if (await activeLot(ctx, state)) throw new Error('Finish the current lot before selecting another');

    const available = await ctx.db
      .query('players')
      .withIndex('by_tournament_and_status', (q) =>
        q.eq('tournamentId', args.tournamentId).eq('status', 'available'),
      )
      .take(1000);
    if (available.length === 0) throw new Error('No available players left to auction');

    const pick = available[Math.floor(Math.random() * available.length)];
    await ctx.db.patch('auctionState', state._id, {
      activePlayerId: pick._id,
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
    await requireTournamentAccess(ctx, args.tournamentId);
    const state = await requireState(ctx, args.tournamentId);
    const player = await activeLot(ctx, state);
    if (!player) {
      throw new Error('No active lot to bid on');
    }
    // Idempotency guard: a stale/duplicate click is silently ignored.
    if (args.expectedBidCount !== undefined && args.expectedBidCount !== state.bidCount) {
      return { ignored: true as const, currentBid: state.currentBid, bidCount: state.bidCount };
    }

    const tournament = await ctx.db.get('tournaments', args.tournamentId);
    if (!tournament) throw new Error('Tournament missing');

    const openingBid = playerMinBid(tournament, player.isCaptain);
    let amount: number;
    if (args.overrideAmount !== undefined) {
      const floor = state.currentBid ?? openingBid;
      if (state.currentBid === undefined ? args.overrideAmount < floor : args.overrideAmount <= floor) {
        throw new Error('Override must exceed the current bid');
      }
      amount = args.overrideAmount;
    } else {
      amount = nextBid(state.currentBid, openingBid, tournament.minBidIncrement);
    }

    // Hard limit: a team may not bid past what it can pay while still affording
    // the minimum for its remaining roster slots. Rejected before any write.
    const team = await ctx.db.get('teams', args.teamId);
    if (!team || team.tournamentId !== args.tournamentId) throw new Error('Team not found');
    if (!canTeamAfford(team, tournament, amount)) {
      throw new Error('Team cannot afford this bid given its remaining roster slots');
    }

    const newBidCount = state.bidCount + 1;
    await ctx.db.patch('auctionState', state._id, {
      currentBid: amount,
      leadingTeamId: args.teamId,
      bidCount: newBidCount,
    });
    await ctx.db.insert('bids', {
      tournamentId: args.tournamentId,
      playerId: player._id,
      teamId: args.teamId,
      amount,
      seq: newBidCount,
      undone: false,
    });
    return { ignored: false as const, currentBid: amount, bidCount: newBidCount };
  },
});

/** Undo the most recent (non-undone) bid on the active lot. */
export const undoBid = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const state = await requireState(ctx, args.tournamentId);
    const player = await activeLot(ctx, state);
    if (!player) return null;

    const playerId = player._id;
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
    await requireTournamentAccess(ctx, args.tournamentId);
    const state = await requireState(ctx, args.tournamentId);
    const player = await activeLot(ctx, state);
    if (!player) throw new Error('No active lot');
    if (!state.leadingTeamId || state.currentBid === undefined) {
      throw new Error('No bids placed — mark unsold instead');
    }

    const team = await ctx.db.get('teams', state.leadingTeamId);
    const tournament = await ctx.db.get('tournaments', args.tournamentId);
    if (!team || !tournament) throw new Error('Auction data missing');
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
    await requireTournamentAccess(ctx, args.tournamentId);
    const state = await requireState(ctx, args.tournamentId);
    const player = await activeLot(ctx, state);
    if (!player) throw new Error('No active lot');
    await ctx.db.patch('players', player._id, { status: 'unsold' });
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
    await requireTournamentAccess(ctx, args.tournamentId);
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

/**
 * Restart the auction from scratch: every player returns to `available`, each
 * team's spent budget is refunded and its roster count cleared, bid history is
 * wiped, and the live state goes idle. The teams and players themselves stay —
 * only their auction results are undone.
 */
export const resetAuction = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);

    // Return every player to the pool, tallying what each team had spent so we
    // can refund it — this restores custom per-team budgets, not just defaults.
    const players = await ctx.db
      .query('players')
      .withIndex('by_tournament_and_sortOrder', (q) => q.eq('tournamentId', args.tournamentId))
      .take(2000);
    const refundByTeam = new Map<Id<'teams'>, number>();
    for (const p of players) {
      if (p.status === 'sold' && p.soldToTeamId && p.soldPrice !== undefined) {
        refundByTeam.set(p.soldToTeamId, (refundByTeam.get(p.soldToTeamId) ?? 0) + p.soldPrice);
      }
      if (p.status !== 'available' || p.soldToTeamId || p.soldPrice !== undefined) {
        await ctx.db.patch('players', p._id, {
          status: 'available',
          soldToTeamId: undefined,
          soldPrice: undefined,
        });
      }
    }

    // Refund each team's spend and clear its roster count.
    const teams = await ctx.db
      .query('teams')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', args.tournamentId))
      .take(200);
    for (const t of teams) {
      const refund = refundByTeam.get(t._id) ?? 0;
      if (refund !== 0 || t.playersWon !== 0) {
        await ctx.db.patch('teams', t._id, {
          remainingBudget: t.remainingBudget + refund,
          playersWon: 0,
        });
      }
    }

    // Wipe bid history for a clean slate.
    for await (const b of ctx.db
      .query('bids')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', args.tournamentId))) {
      await ctx.db.delete('bids', b._id);
    }

    // Idle the live auction state.
    const state = await getState(ctx, args.tournamentId);
    if (state) {
      await ctx.db.patch('auctionState', state._id, {
        activePlayerId: undefined,
        currentBid: undefined,
        leadingTeamId: undefined,
        bidCount: 0,
        phase: 'idle',
      });
    } else {
      await ctx.db.insert('auctionState', {
        tournamentId: args.tournamentId,
        bidCount: 0,
        phase: 'idle',
      });
    }
    return null;
  },
});

/** Admin console state: active lot, leading team, and per-team affordability. */
export const consoleState = query({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const tournament = await ctx.db.get('tournaments', args.tournamentId);
    if (!tournament) return null;
    const state = await getState(ctx, args.tournamentId);

    const teams = await ctx.db
      .query('teams')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', args.tournamentId))
      .take(100);

    // Roster contents: the players each team has already won.
    const soldPlayers = await ctx.db
      .query('players')
      .withIndex('by_tournament_and_status', (q) =>
        q.eq('tournamentId', args.tournamentId).eq('status', 'sold'),
      )
      .take(1000);
    const rosterByTeam = new Map<string, { _id: Id<'players'>; name: string; soldPrice: number }[]>();
    for (const p of soldPlayers) {
      if (!p.soldToTeamId) continue;
      const list = rosterByTeam.get(p.soldToTeamId) ?? [];
      list.push({ _id: p._id, name: p.name, soldPrice: p.soldPrice ?? 0 });
      rosterByTeam.set(p.soldToTeamId, list);
    }

    // Trust the live lot, not the raw phase: if the active player dangles (left
    // over from a prior session or deleted mid-lot), the console treats the
    // auction as idle so it falls back to the picker instead of hanging.
    const liveLot = state ? await activeLot(ctx, state) : null;
    const activePlayer = liveLot
      ? {
          ...liveLot,
          minBid: playerMinBid(tournament, liveLot.isCaptain),
          imageUrl: liveLot.imageStorageId ? await ctx.storage.getUrl(liveLot.imageStorageId) : null,
        }
      : null;

    const teamsFull = teams.filter((t) => t.playersWon >= tournament.rosterSize).length;
    const availableCount = await ctx.db
      .query('players')
      .withIndex('by_tournament_and_status', (q) =>
        q.eq('tournamentId', args.tournamentId).eq('status', 'available'),
      )
      .take(1000);

    return {
      tournament,
      phase: liveLot ? ('bidding' as const) : ('idle' as const),
      currentBid: liveLot ? state?.currentBid ?? null : null,
      leadingTeamId: liveLot ? state?.leadingTeamId ?? null : null,
      bidCount: liveLot ? state?.bidCount ?? 0 : 0,
      activePlayer,
      teamsFull,
      teamCount: teams.length,
      rostersComplete: teams.length > 0 && teamsFull === teams.length,
      availablePlayers: availableCount.length,
      teams: teams.map((t) => ({
        ...t,
        maxBid: maxAffordableBid(t, tournament),
        budgetStatus: budgetStatus(t, tournament),
        roster: rosterByTeam.get(t._id) ?? [],
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
    const player = state ? await activeLot(ctx, state) : null;
    if (!state || !player) {
      return { phase: 'idle' as const };
    }
    const leadingTeam = state.leadingTeamId ? await ctx.db.get('teams', state.leadingTeamId) : null;
    return {
      phase: 'bidding' as const,
      currentBid: state.currentBid ?? null,
      player: {
        name: player.name,
        role: player.role ?? null,
        minBid: playerMinBid(tournament, player.isCaptain),
        imageUrl: player.imageStorageId ? await ctx.storage.getUrl(player.imageStorageId) : null,
      },
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
    const soldPlayers = await ctx.db
      .query('players')
      .withIndex('by_tournament_and_status', (q) =>
        q.eq('tournamentId', tournament._id).eq('status', 'sold'),
      )
      .take(1000);
    const rosterByTeam = new Map<string, { name: string; soldPrice: number }[]>();
    for (const p of soldPlayers) {
      if (!p.soldToTeamId) continue;
      const list = rosterByTeam.get(p.soldToTeamId) ?? [];
      list.push({ name: p.name, soldPrice: p.soldPrice ?? 0 });
      rosterByTeam.set(p.soldToTeamId, list);
    }
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
          budgetStatus: budgetStatus(t, tournament),
          roster: rosterByTeam.get(t._id) ?? [],
        })),
      ),
    };
  },
});
