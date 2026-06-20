import { QueryCtx } from '../_generated/server';

/**
 * Resolve the tournament a public viewer token may currently display. Both
 * `live` and `completed` tournaments resolve — a finished event keeps showing
 * its final table and champion until the token is rotated. Drafts and unknown
 * tokens return null so the live screen reads as invalid.
 */
export async function resolveViewer(ctx: QueryCtx, token: string) {
  if (!token) return null;
  const tournament = await ctx.db
    .query('tournaments')
    .withIndex('by_viewerToken', (q) => q.eq('viewerToken', token))
    .unique();
  if (!tournament || (tournament.status !== 'live' && tournament.status !== 'completed')) {
    return null;
  }
  return tournament;
}
