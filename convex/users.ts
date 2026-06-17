import { v } from 'convex/values';
import { internalMutation, mutation, query, MutationCtx } from './_generated/server';
import { Id } from './_generated/dataModel';
import { getCurrentUser, requireSuperAdmin } from './lib/auth';

const roleValidator = v.union(v.literal('admin'), v.literal('member'));

/**
 * Idempotently link the authenticated WorkOS identity to its `users` row.
 *
 * Access is invite-only: rows are pre-created by email (via `invite`/`grantRole`
 * or by being added to a tournament). On login we either find the row by its
 * stable `tokenIdentifier`, or link a pending invite by email. A visitor with no
 * invite gets no row — and therefore no portal access.
 */
export const syncUser = mutation({
  args: {},
  handler: async (ctx): Promise<Id<'users'> | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');

    const email = (identity.email ?? '').toLowerCase();
    const name = identity.name ?? undefined;

    // (1) Already linked: keep display fields fresh, never touch role here.
    const existing = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();
    if (existing) {
      if (existing.email !== email || existing.name !== name) {
        await ctx.db.patch('users', existing._id, { email, name });
      }
      return existing._id;
    }

    // (2) Pending invite (a row created by email with no tokenIdentifier yet).
    if (email) {
      const invited = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', email))
        .unique();
      if (invited && !invited.tokenIdentifier) {
        await ctx.db.patch('users', invited._id, { tokenIdentifier: identity.tokenIdentifier, name });
        return invited._id;
      }
    }

    // (3) Not invited — no portal access.
    return null;
  },
});

/** The current user's synced profile (null if unauthenticated or not invited). */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    return { _id: user._id, email: user.email, name: user.name, role: user.role };
  },
});

/** Super-admin only: list all users for roster management. */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    return await ctx.db.query('users').take(200);
  },
});

/**
 * Super-admin only: invite an email into the portal at the given role. Creates a
 * pending `users` row (linked to a WorkOS identity on their first login) or
 * updates the role of an existing one. Returns the user id.
 */
export const invite = mutation({
  args: { email: v.string(), role: roleValidator },
  handler: async (ctx, args): Promise<Id<'users'>> => {
    const admin = await requireSuperAdmin(ctx);
    return await upsertUserByEmail(ctx, args.email, args.role, admin._id);
  },
});

/** Super-admin only: promote or demote a user. */
export const setUserRole = mutation({
  args: { userId: v.id('users'), role: roleValidator },
  handler: async (ctx, args) => {
    await requireSuperAdmin(ctx);
    await ctx.db.patch('users', args.userId, { role: args.role });
    return null;
  },
});

/** Super-admin only: remove a user and all their tournament memberships. */
export const remove = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const admin = await requireSuperAdmin(ctx);
    if (args.userId === admin._id) throw new Error('You cannot remove yourself');
    const memberships = await ctx.db
      .query('tournamentMembers')
      .withIndex('by_user_and_tournament', (q) => q.eq('userId', args.userId))
      .take(500);
    for (const m of memberships) {
      await ctx.db.delete('tournamentMembers', m._id);
    }
    await ctx.db.delete('users', args.userId);
    return null;
  },
});

/**
 * CLI bootstrap entry point (not in the public API). Seed the first super-admin
 * before anyone exists to grant roles from `/internal`:
 *
 *   npx convex run users:grantRole '{"email":"you@example.com","role":"admin"}'
 */
export const grantRole = internalMutation({
  args: { email: v.string(), role: roleValidator },
  handler: async (ctx, args): Promise<Id<'users'>> => {
    return await upsertUserByEmail(ctx, args.email, args.role);
  },
});

/**
 * Shared upsert: find a `users` row by (lowercased) email and set its role, or
 * create a pending invite row. Used by `invite`, `grantRole`, and tournament
 * member additions.
 */
export async function upsertUserByEmail(
  ctx: MutationCtx,
  rawEmail: string,
  role: 'admin' | 'member',
  invitedBy?: Id<'users'>,
): Promise<Id<'users'>> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) throw new Error('Email is required');
  const existing = await ctx.db
    .query('users')
    .withIndex('by_email', (q) => q.eq('email', email))
    .unique();
  if (existing) {
    if (existing.role !== role) {
      await ctx.db.patch('users', existing._id, { role });
    }
    return existing._id;
  }
  return await ctx.db.insert('users', { email, role, invitedBy });
}
