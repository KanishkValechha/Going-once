import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// Going Once — offline sports-auction backend.
// One tournament is `live` at a time; teams, players, the live auction state,
// and the viewer token all scope under a `tournaments` row.
export default defineSchema({
  // Identity synced from WorkOS on login. `tokenIdentifier` is the canonical,
  // stable WorkOS identity (issuer|subject) — never trust a client-supplied id.
  // A row may be pre-created by email (an invite) before that person's first
  // login, so `tokenIdentifier` is absent until they sign in and get linked.
  users: defineTable({
    tokenIdentifier: v.optional(v.string()),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(v.literal('admin'), v.literal('member')),
    invitedBy: v.optional(v.id('users')),
  })
    .index('by_tokenIdentifier', ['tokenIdentifier'])
    .index('by_email', ['email']),

  // Stable per-event config. The secret `viewerToken` gates the public /live screen.
  tournaments: defineTable({
    name: v.string(),
    status: v.union(v.literal('draft'), v.literal('live'), v.literal('completed')),
    viewerToken: v.string(),
    defaultBudget: v.number(),
    rosterSize: v.number(),
    minBidIncrement: v.number(),
    // Tournament-wide opening/minimum bid that applies to every non-captain
    // player. Optional so tournaments created before it existed still validate;
    // reads fall back to a default.
    minBid: v.optional(v.number()),
    // Legacy: superseded by the per-captain `players.captainMinBid`. Kept
    // optional so older tournament docs that set it still validate. Unused.
    captainMinBid: v.optional(v.number()),
    createdBy: v.id('users'),
  })
    .index('by_status', ['status'])
    .index('by_viewerToken', ['viewerToken']),

  // Per-tournament edit access. A `member` can only see/edit tournaments they
  // have a row here for (the creator is added automatically on create).
  // Super-admins (`users.role === 'admin'`) bypass this and access everything.
  tournamentMembers: defineTable({
    tournamentId: v.id('tournaments'),
    userId: v.id('users'),
    addedBy: v.id('users'),
  })
    .index('by_tournament', ['tournamentId'])
    .index('by_user_and_tournament', ['userId', 'tournamentId']),

  // Teams: slow-churn. `remainingBudget`/`playersWon` only change on Sold (or undo).
  teams: defineTable({
    tournamentId: v.id('tournaments'),
    name: v.string(),
    logoStorageId: v.optional(v.id('_storage')),
    remainingBudget: v.number(),
    playersWon: v.number(),
  }).index('by_tournament', ['tournamentId']),

  // Players are the auction lots.
  players: defineTable({
    tournamentId: v.id('tournaments'),
    name: v.string(),
    role: v.optional(v.string()),
    // Per-player base price is no longer used — a regular player's opening bid
    // comes from the tournament's `minBid`. Kept optional for legacy rows.
    basePrice: v.optional(v.number()),
    // A captain's own minimum/opening bid. Only meaningful when `isCaptain`;
    // falls back to the tournament `minBid` if unset.
    captainMinBid: v.optional(v.number()),
    imageStorageId: v.optional(v.id('_storage')),
    isCaptain: v.boolean(),
    status: v.union(v.literal('available'), v.literal('sold'), v.literal('unsold')),
    soldToTeamId: v.optional(v.id('teams')),
    soldPrice: v.optional(v.number()),
    sortOrder: v.number(),
  })
    .index('by_tournament_and_status', ['tournamentId', 'status'])
    .index('by_tournament_and_sortOrder', ['tournamentId', 'sortOrder']),

  // HIGH-CHURN: the live auction state (one row per tournament). Split from
  // `tournaments` so a bid click only contends with this tiny row, never with
  // stable config reads.
  auctionState: defineTable({
    tournamentId: v.id('tournaments'),
    activePlayerId: v.optional(v.id('players')),
    currentBid: v.optional(v.number()),
    leadingTeamId: v.optional(v.id('teams')),
    bidCount: v.number(),
    phase: v.union(v.literal('idle'), v.literal('bidding')),
  }).index('by_tournament', ['tournamentId']),

  // Append-only bid history (a child table, never an array on a doc).
  bids: defineTable({
    tournamentId: v.id('tournaments'),
    playerId: v.id('players'),
    teamId: v.id('teams'),
    amount: v.number(),
    seq: v.number(),
    undone: v.boolean(),
  })
    .index('by_player_and_seq', ['playerId', 'seq'])
    .index('by_tournament', ['tournamentId']),
});
