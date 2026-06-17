import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getCurrentUser, requireAdmin } from './lib/auth';

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Idempotently sync the authenticated WorkOS identity into the `users` table.
 * Called from the client once the user is authenticated. On first insert the
 * role is derived server-side from the ADMIN_EMAILS allowlist — never from a
 * client argument.
 */
export const syncUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    const email = (identity.email ?? '').toLowerCase();
    const name = identity.name ?? undefined;

    const existing = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();

    if (existing) {
      // Keep display fields fresh but never silently downgrade/upgrade role here.
      if (existing.email !== email || existing.name !== name) {
        await ctx.db.patch('users', existing._id, { email, name });
      }
      return existing._id;
    }

    const role = email && adminEmails().has(email) ? 'admin' : 'member';
    return await ctx.db.insert('users', {
      tokenIdentifier: identity.tokenIdentifier,
      email,
      name,
      role,
    });
  },
});

/** The current user's synced profile (null if unauthenticated or unsynced). */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return { _id: user._id, email: user.email, name: user.name, role: user.role };
  },
});

/** Admin-only: promote or demote another user. */
export const setUserRole = mutation({
  args: {
    userId: v.id('users'),
    role: v.union(v.literal('admin'), v.literal('member')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch('users', args.userId, { role: args.role });
    return null;
  },
});

/** Admin-only: list all users for role management. */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query('users').take(200);
  },
});
