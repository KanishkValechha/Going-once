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
    // 'result' keeps a just-sold/unsold player on screen (console + live) until
    // the auctioneer advances to the next lot.
    phase: v.union(v.literal('idle'), v.literal('bidding'), v.literal('result')),
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

  // The post-auction tournament fixture. One bracket per tournament (regenerating
  // wipes and recreates it). `seed` is the random draw order of team ids — small
  // and bounded by team count, so an inline array is fine here.
  brackets: defineTable({
    tournamentId: v.id('tournaments'),
    format: v.union(
      v.literal('single_elimination'),
      v.literal('round_robin'),
      v.literal('groups_knockout'),
    ),
    seed: v.array(v.id('teams')),
    // groups_knockout only: how many random groups, and how many advance per group.
    groupCount: v.optional(v.number()),
    advancePerGroup: v.optional(v.number()),
    // groups_knockout: flips true once the group stage finishes and the knockout
    // round has been seeded from the group standings (so we only seed once).
    knockoutSeeded: v.optional(v.boolean()),
  }).index('by_tournament', ['tournamentId']),

  // Individual fixtures within a bracket (a child table, never an array on a doc).
  matches: defineTable({
    tournamentId: v.id('tournaments'),
    bracketId: v.id('brackets'),
    // 'group' = round-robin fixture (pure round robin or a groups_knockout group);
    // 'knockout' = single-elimination match (incl. the groups_knockout finals).
    stage: v.union(v.literal('group'), v.literal('knockout')),
    // Which group (groups_knockout); 0 for pure round robin; undefined for knockout.
    groupIndex: v.optional(v.number()),
    round: v.number(),
    // Position of this match within its round, for stable rendering order.
    slot: v.number(),
    label: v.optional(v.string()),
    teamAId: v.optional(v.id('teams')),
    teamBId: v.optional(v.id('teams')),
    // Human hint shown before a knockout slot's feeder is decided ("Winner of QF1",
    // "Group A #1"). Cleared once the real team lands.
    teamASource: v.optional(v.string()),
    teamBSource: v.optional(v.string()),
    // Knockout advancement: the winner flows into this match's given slot
    // (0 => teamA, 1 => teamB). Absent on the final and on group matches.
    nextMatchId: v.optional(v.id('matches')),
    nextSlot: v.optional(v.number()),
    scoreA: v.optional(v.number()),
    scoreB: v.optional(v.number()),
    winnerTeamId: v.optional(v.id('teams')),
    // 'pending' = waiting on a team to be decided; 'ready' = both teams known,
    // playable; 'done' = result recorded. Byes are auto-resolved to 'done'.
    status: v.union(v.literal('pending'), v.literal('ready'), v.literal('done')),
    isBye: v.optional(v.boolean()),
  })
    .index('by_bracket', ['bracketId'])
    .index('by_tournament', ['tournamentId']),
});
