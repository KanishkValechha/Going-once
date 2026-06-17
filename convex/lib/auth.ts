import { Doc } from '../_generated/dataModel';
import { QueryCtx, MutationCtx } from '../_generated/server';

type AnyCtx = QueryCtx | MutationCtx;

/**
 * Resolve the Convex `users` row for the currently authenticated WorkOS
 * identity. Returns null if unauthenticated or not yet synced.
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
 * Gate admin-only functions. Throws unless the caller is an authenticated,
 * synced user with the `admin` role.
 */
export async function requireAdmin(ctx: AnyCtx): Promise<Doc<'users'>> {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error('Unauthenticated');
  if (user.role !== 'admin') throw new Error('Forbidden: admin access required');
  return user;
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
