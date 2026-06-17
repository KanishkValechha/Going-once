import { Doc, Id } from '../_generated/dataModel';
import { QueryCtx, MutationCtx } from '../_generated/server';

type AnyCtx = QueryCtx | MutationCtx;

/**
 * Resolve the Convex `users` row for the currently authenticated WorkOS
 * identity. Returns null if unauthenticated or not yet synced/invited.
 */
export async function getCurrentUser(ctx: AnyCtx): Promise<Doc<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
    .unique();
}

/**
 * Gate portal functions. Throws unless the caller is an authenticated user with
 * a synced `users` row — i.e. they were invited (rows only exist for invitees
 * and the bootstrapped super-admin). Returns the user (admin or member).
 */
export async function requireUser(ctx: AnyCtx): Promise<Doc<'users'>> {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error('Forbidden: no portal access');
  return user;
}

/**
 * Gate super-admin-only functions (the user roster and global ops). Throws
 * unless the caller has the `admin` role.
 */
export async function requireSuperAdmin(ctx: AnyCtx): Promise<Doc<'users'>> {
  const user = await requireUser(ctx);
  if (user.role !== 'admin') throw new Error('Forbidden: admin access required');
  return user;
}

/**
 * Gate per-tournament functions. Super-admins access any tournament; members
 * must have a `tournamentMembers` row for this tournament. Throws otherwise.
 */
export async function requireTournamentAccess(
  ctx: AnyCtx,
  tournamentId: Id<'tournaments'>,
): Promise<Doc<'users'>> {
  const user = await requireUser(ctx);
  if (user.role === 'admin') return user;
  const membership = await ctx.db
    .query('tournamentMembers')
    .withIndex('by_user_and_tournament', (q) =>
      q.eq('userId', user._id).eq('tournamentId', tournamentId),
    )
    .unique();
  if (!membership) throw new Error('Forbidden: no access to this tournament');
  return user;
}

/** Resolve a team's parent tournament and gate access to it. */
export async function requireAccessForTeam(ctx: AnyCtx, teamId: Id<'teams'>): Promise<Doc<'users'>> {
  const team = await ctx.db.get('teams', teamId);
  if (!team) throw new Error('Team not found');
  return await requireTournamentAccess(ctx, team.tournamentId);
}

/** Resolve a player's parent tournament and gate access to it. */
export async function requireAccessForPlayer(
  ctx: AnyCtx,
  playerId: Id<'players'>,
): Promise<Doc<'users'>> {
  const player = await ctx.db.get('players', playerId);
  if (!player) throw new Error('Player not found');
  return await requireTournamentAccess(ctx, player.tournamentId);
}

/**
 * Validate a viewer token for the public /live screen. The token is the
 * capability — no WorkOS auth involved. Returns the matching `live` tournament
 * or throws.
 */
export async function requireViewer(ctx: QueryCtx, token: string): Promise<Doc<'tournaments'>> {
  if (!token) throw new Error('Missing viewer token');
  const tournament = await ctx.db
    .query('tournaments')
    .withIndex('by_viewerToken', (q) => q.eq('viewerToken', token))
    .unique();
  if (!tournament || tournament.status !== 'live') {
    throw new Error('Invalid or inactive viewer token');
  }
  return tournament;
}
