import { v } from 'convex/values';
import { mutation, query, MutationCtx } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import { requireTournamentAccess } from './lib/auth';

// ---------------------------------------------------------------------------
// Pure bracket maths — no ctx, easy to reason about.
// ---------------------------------------------------------------------------

/** Fisher–Yates shuffle (in place), returning the same array. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Smallest power of two >= n (min 2). */
function nextPow2(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard single-elimination seed order for a bracket of `size` slots.
 * Returns a length-`size` array where entry i is the 1-indexed seed that belongs
 * in slot i. This is the classic recursive pairing (1 plays the lowest seed,
 * etc.) so that, with byes assigned to the highest seed numbers, no two byes ever
 * land in the same opening match.
 */
function seedSlots(size: number): number[] {
  let slots = [1];
  while (slots.length < size) {
    const sum = slots.length * 2 + 1;
    const next: number[] = [];
    for (const s of slots) {
      next.push(s);
      next.push(sum - s);
    }
    slots = next;
  }
  return slots;
}

/** Knockout round name from the number of teams contesting that round. */
function knockoutRoundLabel(teamsInRound: number): string {
  if (teamsInRound === 2) return 'Final';
  if (teamsInRound === 4) return 'Semifinal';
  if (teamsInRound === 8) return 'Quarterfinal';
  return `Round of ${teamsInRound}`;
}

// ---------------------------------------------------------------------------
// Builders — create the match rows for each format.
// ---------------------------------------------------------------------------

/**
 * Create the empty match shells for a single-elimination tree of `size` slots
 * (a power of two). Links each match to where its winner advances. Returns the
 * round-0 match ids in slot order so teams can be placed afterwards.
 */
async function buildKnockoutShells(
  ctx: MutationCtx,
  tournamentId: Id<'tournaments'>,
  bracketId: Id<'brackets'>,
  size: number,
): Promise<Id<'matches'>[]> {
  const totalRounds = Math.log2(size);
  // Build from the final backwards so a match knows its `nextMatchId` at insert.
  let nextRoundIds: Id<'matches'>[] = [];
  const round0: Id<'matches'>[] = [];
  for (let r = totalRounds - 1; r >= 0; r--) {
    const count = size / Math.pow(2, r + 1);
    const teamsInRound = count * 2;
    const thisRoundIds: Id<'matches'>[] = [];
    for (let j = 0; j < count; j++) {
      const id = await ctx.db.insert('matches', {
        tournamentId,
        bracketId,
        stage: 'knockout',
        round: r,
        slot: j,
        label: knockoutRoundLabel(teamsInRound),
        nextMatchId: r === totalRounds - 1 ? undefined : nextRoundIds[Math.floor(j / 2)],
        nextSlot: r === totalRounds - 1 ? undefined : j % 2,
        status: 'pending',
      });
      thisRoundIds.push(id);
    }
    if (r === 0) round0.push(...thisRoundIds);
    nextRoundIds = thisRoundIds;
  }
  return round0;
}

/**
 * Place an ordered list of teams into a freshly built knockout tree and resolve
 * any byes. `ordered` holds the teams in seed order (length = number of real
 * teams, m); the remaining `size - m` seeds are byes. A match with a single team
 * auto-advances that team to the next round.
 */
async function seedKnockout(
  ctx: MutationCtx,
  round0: Id<'matches'>[],
  ordered: Id<'teams'>[],
  size: number,
  sourceLabels?: string[],
) {
  const slots = seedSlots(size); // slot -> 1-indexed seed
  const teamAtSlot: (Id<'teams'> | null)[] = slots.map((seed) =>
    seed <= ordered.length ? ordered[seed - 1] : null,
  );
  const labelAtSlot: (string | undefined)[] = slots.map((seed) =>
    sourceLabels && seed <= sourceLabels.length ? sourceLabels[seed - 1] : undefined,
  );

  for (let j = 0; j < round0.length; j++) {
    const a = teamAtSlot[2 * j];
    const b = teamAtSlot[2 * j + 1];
    const matchId = round0[j];
    await ctx.db.patch('matches', matchId, {
      teamAId: a ?? undefined,
      teamBId: b ?? undefined,
      teamASource: a ? undefined : labelAtSlot[2 * j],
      teamBSource: b ? undefined : labelAtSlot[2 * j + 1],
    });
    if (a && b) {
      await ctx.db.patch('matches', matchId, { status: 'ready' });
    } else if (a || b) {
      // Bye: the lone team walks over to the next round.
      const match = await ctx.db.get('matches', matchId);
      if (match) await applyKnockoutResult(ctx, match, (a ?? b)!, true);
    }
  }
}

/**
 * Round-robin fixtures via the circle method. If the team count is odd a virtual
 * bye rotates through, giving each team one rest round.
 */
async function buildRoundRobin(
  ctx: MutationCtx,
  tournamentId: Id<'tournaments'>,
  bracketId: Id<'brackets'>,
  teams: Id<'teams'>[],
  groupIndex: number,
  groupLabel: string,
) {
  const ids: (Id<'teams'> | null)[] = [...teams];
  if (ids.length % 2 === 1) ids.push(null); // bye marker
  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  // Fixed first element, rotate the rest.
  let order = [...ids];
  for (let r = 0; r < rounds; r++) {
    let slot = 0;
    for (let i = 0; i < half; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      if (a && b) {
        await ctx.db.insert('matches', {
          tournamentId,
          bracketId,
          stage: 'group',
          groupIndex,
          round: r,
          slot: slot++,
          label: groupLabel ? `${groupLabel} · Round ${r + 1}` : `Round ${r + 1}`,
          teamAId: a,
          teamBId: b,
          status: 'ready',
        });
      }
    }
    // Rotate: keep index 0 fixed, move the last into position 1.
    order = [order[0], order[n - 1], ...order.slice(1, n - 1)];
  }
}

// ---------------------------------------------------------------------------
// Advancement.
// ---------------------------------------------------------------------------

/**
 * Record a knockout winner and push them into their next match's slot. `isBye`
 * marks walkovers (no scores). Recomputes the next match's readiness and chains
 * further walkovers if the next match also becomes a single-team bye.
 */
async function applyKnockoutResult(
  ctx: MutationCtx,
  match: Doc<'matches'>,
  winnerId: Id<'teams'>,
  isBye: boolean,
) {
  await ctx.db.patch('matches', match._id, {
    winnerTeamId: winnerId,
    status: 'done',
    isBye: isBye ? true : undefined,
  });
  if (!match.nextMatchId) return;
  const next = await ctx.db.get('matches', match.nextMatchId);
  if (!next) return;
  const field = match.nextSlot === 0 ? 'teamAId' : 'teamBId';
  const sourceField = match.nextSlot === 0 ? 'teamASource' : 'teamBSource';
  await ctx.db.patch('matches', next._id, { [field]: winnerId, [sourceField]: undefined });
  const updated = await ctx.db.get('matches', next._id);
  if (!updated || updated.status === 'done') return;
  if (updated.teamAId && updated.teamBId) {
    await ctx.db.patch('matches', next._id, { status: 'ready' });
  }
}

// ---------------------------------------------------------------------------
// Standings (for round robin & group stages).
// ---------------------------------------------------------------------------

export type Standing = {
  teamId: Id<'teams'>;
  played: number;
  win: number;
  draw: number;
  loss: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

/** League table for a set of group matches (3 for a win, 1 for a draw). */
function computeStandings(teamIds: Id<'teams'>[], matches: Doc<'matches'>[]): Standing[] {
  const table = new Map<Id<'teams'>, Standing>();
  for (const id of teamIds) {
    table.set(id, {
      teamId: id,
      played: 0,
      win: 0,
      draw: 0,
      loss: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    });
  }
  for (const m of matches) {
    if (m.status !== 'done' || !m.teamAId || !m.teamBId) continue;
    const a = table.get(m.teamAId);
    const b = table.get(m.teamBId);
    if (!a || !b) continue;
    const sa = m.scoreA ?? 0;
    const sb = m.scoreB ?? 0;
    a.played++;
    b.played++;
    a.goalsFor += sa;
    a.goalsAgainst += sb;
    b.goalsFor += sb;
    b.goalsAgainst += sa;
    if (sa > sb) {
      a.win++;
      b.loss++;
      a.points += 3;
    } else if (sb > sa) {
      b.win++;
      a.loss++;
      b.points += 3;
    } else {
      a.draw++;
      b.draw++;
      a.points += 1;
      b.points += 1;
    }
  }
  return [...table.values()]
    .map((s) => ({ ...s, goalDiff: s.goalsFor - s.goalsAgainst }))
    .sort(
      (x, y) =>
        y.points - x.points ||
        y.goalDiff - x.goalDiff ||
        y.goalsFor - x.goalsFor ||
        y.win - x.win,
    );
}

// ---------------------------------------------------------------------------
// Mutations.
// ---------------------------------------------------------------------------

/** Delete a tournament's bracket and all its matches, if any. */
async function clearBracketInternal(ctx: MutationCtx, tournamentId: Id<'tournaments'>) {
  const bracket = await ctx.db
    .query('brackets')
    .withIndex('by_tournament', (q) => q.eq('tournamentId', tournamentId))
    .unique();
  if (!bracket) return;
  // Batch-delete matches to stay within transaction limits.
  for (;;) {
    const batch = await ctx.db
      .query('matches')
      .withIndex('by_bracket', (q) => q.eq('bracketId', bracket._id))
      .take(256);
    if (batch.length === 0) break;
    for (const m of batch) await ctx.db.delete('matches', m._id);
    if (batch.length < 256) break;
  }
  await ctx.db.delete('brackets', bracket._id);
}

/**
 * Generate (or regenerate) the tournament fixture from the current teams with a
 * fresh random draw. Wipes any prior bracket first.
 */
export const generate = mutation({
  args: {
    tournamentId: v.id('tournaments'),
    format: v.union(
      v.literal('single_elimination'),
      v.literal('round_robin'),
      v.literal('groups_knockout'),
    ),
    groupCount: v.optional(v.number()),
    advancePerGroup: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const teams = await ctx.db
      .query('teams')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', args.tournamentId))
      .take(100);
    if (teams.length < 2) throw new Error('Need at least 2 teams to generate matches');

    const seed = shuffle(teams.map((t) => t._id));
    await clearBracketInternal(ctx, args.tournamentId);

    if (args.format === 'single_elimination') {
      const bracketId = await ctx.db.insert('brackets', {
        tournamentId: args.tournamentId,
        format: 'single_elimination',
        seed,
      });
      const size = nextPow2(seed.length);
      const round0 = await buildKnockoutShells(ctx, args.tournamentId, bracketId, size);
      await seedKnockout(ctx, round0, seed, size);
      return bracketId;
    }

    if (args.format === 'round_robin') {
      const bracketId = await ctx.db.insert('brackets', {
        tournamentId: args.tournamentId,
        format: 'round_robin',
        seed,
      });
      await buildRoundRobin(ctx, args.tournamentId, bracketId, seed, 0, '');
      return bracketId;
    }

    // groups_knockout
    const groupCount = Math.max(2, Math.min(args.groupCount ?? 2, Math.floor(seed.length / 2)));
    const advancePerGroup = Math.max(1, args.advancePerGroup ?? 2);
    const bracketId = await ctx.db.insert('brackets', {
      tournamentId: args.tournamentId,
      format: 'groups_knockout',
      seed,
      groupCount,
      advancePerGroup,
      knockoutSeeded: false,
    });
    // Snake-free simple split: deal teams round-robin into groups for even sizes.
    const groups: Id<'teams'>[][] = Array.from({ length: groupCount }, () => []);
    seed.forEach((id, i) => groups[i % groupCount].push(id));
    for (let g = 0; g < groupCount; g++) {
      const label = `Group ${String.fromCharCode(65 + g)}`;
      await buildRoundRobin(ctx, args.tournamentId, bracketId, groups[g], g, label);
    }
    // Pre-build the knockout shells with "Group X #n" placeholders; teams land
    // once the group stage finishes (see maybeSeedKnockout).
    const qualifiers = groupCount * advancePerGroup;
    const size = nextPow2(qualifiers);
    const round0 = await buildKnockoutShells(ctx, args.tournamentId, bracketId, size);
    const labels = orderedQualifierLabels(groupCount, advancePerGroup);
    // Stash the placeholder labels on round-0 slots so the UI reads sensibly
    // before any group result is in.
    await seedKnockout(ctx, round0, [], size, labels);
    return bracketId;
  },
});

/** Qualifier seed labels in the order they fill the knockout (winners, then runners-up …). */
function orderedQualifierLabels(groupCount: number, advancePerGroup: number): string[] {
  const labels: string[] = [];
  for (let pos = 0; pos < advancePerGroup; pos++) {
    for (let g = 0; g < groupCount; g++) {
      labels.push(`Group ${String.fromCharCode(65 + g)} #${pos + 1}`);
    }
  }
  return labels;
}

/** Once every group match is done, seed the knockout from the group standings. */
async function maybeSeedKnockout(ctx: MutationCtx, bracket: Doc<'brackets'>) {
  if (bracket.format !== 'groups_knockout' || bracket.knockoutSeeded) return;
  const all = await ctx.db
    .query('matches')
    .withIndex('by_bracket', (q) => q.eq('bracketId', bracket._id))
    .take(2000);
  const groupMatches = all.filter((m) => m.stage === 'group');
  if (groupMatches.some((m) => m.status !== 'done')) return; // group stage unfinished

  const groupCount = bracket.groupCount ?? 2;
  const advancePerGroup = bracket.advancePerGroup ?? 2;
  // Qualifiers in the same order as the placeholder labels: winners first.
  const ordered: Id<'teams'>[] = [];
  for (let pos = 0; pos < advancePerGroup; pos++) {
    for (let g = 0; g < groupCount; g++) {
      const gm = groupMatches.filter((m) => m.groupIndex === g);
      const teamIds = [
        ...new Set(gm.flatMap((m) => [m.teamAId, m.teamBId].filter(Boolean) as Id<'teams'>[])),
      ];
      const standing = computeStandings(teamIds, gm);
      if (standing[pos]) ordered.push(standing[pos].teamId);
    }
  }
  const round0 = all
    .filter((m) => m.stage === 'knockout' && m.round === 0)
    .sort((a, b) => a.slot - b.slot)
    .map((m) => m._id);
  const size = nextPow2(groupCount * advancePerGroup);
  await seedKnockout(ctx, round0, ordered, size);
  await ctx.db.patch('brackets', bracket._id, { knockoutSeeded: true });
}

/**
 * Record (or correct) a match result. Knockout matches must have a winner;
 * group matches may be drawn. Recording a knockout result advances the winner;
 * completing a group stage seeds the knockout.
 */
export const recordScore = mutation({
  args: {
    matchId: v.id('matches'),
    scoreA: v.number(),
    scoreB: v.number(),
  },
  handler: async (ctx, args) => {
    const match = await ctx.db.get('matches', args.matchId);
    if (!match) throw new Error('Match not found');
    await requireTournamentAccess(ctx, match.tournamentId);
    if (!match.teamAId || !match.teamBId) throw new Error('Both teams must be decided first');
    if (args.scoreA < 0 || args.scoreB < 0) throw new Error('Scores cannot be negative');

    const bracket = await ctx.db.get('brackets', match.bracketId);
    if (!bracket) throw new Error('Bracket not found');

    if (match.stage === 'knockout') {
      if (args.scoreA === args.scoreB) {
        throw new Error('A knockout match needs a winner — scores cannot be tied');
      }
      // Block correcting a result whose winner has already played on.
      if (match.nextMatchId) {
        const next = await ctx.db.get('matches', match.nextMatchId);
        if (next && next.status === 'done') {
          throw new Error('Undo the following match before changing this result');
        }
      }
      const winnerId = args.scoreA > args.scoreB ? match.teamAId : match.teamBId;
      await ctx.db.patch('matches', match._id, {
        scoreA: args.scoreA,
        scoreB: args.scoreB,
      });
      const fresh = await ctx.db.get('matches', match._id);
      if (fresh) await applyKnockoutResult(ctx, fresh, winnerId, false);
      return null;
    }

    // Group / round-robin match.
    if (bracket.knockoutSeeded) {
      throw new Error('Group results are locked once the knockout stage is seeded');
    }
    const winnerId =
      args.scoreA > args.scoreB
        ? match.teamAId
        : args.scoreB > args.scoreA
          ? match.teamBId
          : undefined;
    await ctx.db.patch('matches', match._id, {
      scoreA: args.scoreA,
      scoreB: args.scoreB,
      winnerTeamId: winnerId,
      status: 'done',
    });
    await maybeSeedKnockout(ctx, bracket);
    return null;
  },
});

/** Tear down the bracket so a fresh one can be drawn. */
export const reset = mutation({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    await clearBracketInternal(ctx, args.tournamentId);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Query.
// ---------------------------------------------------------------------------

/**
 * The full bracket for rendering: meta, matches enriched with team names/logos,
 * and computed group standings. Returns null when no bracket exists yet.
 */
export const view = query({
  args: { tournamentId: v.id('tournaments') },
  handler: async (ctx, args) => {
    await requireTournamentAccess(ctx, args.tournamentId);
    const bracket = await ctx.db
      .query('brackets')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', args.tournamentId))
      .unique();
    if (!bracket) return null;

    const teams = await ctx.db
      .query('teams')
      .withIndex('by_tournament', (q) => q.eq('tournamentId', args.tournamentId))
      .take(100);
    const teamById = new Map(teams.map((t) => [t._id, t]));
    const nameOf = (id: Id<'teams'> | undefined) => (id ? (teamById.get(id)?.name ?? null) : null);

    const matches = await ctx.db
      .query('matches')
      .withIndex('by_bracket', (q) => q.eq('bracketId', bracket._id))
      .take(2000);

    const enriched = matches
      .map((m) => ({
        ...m,
        teamAName: nameOf(m.teamAId),
        teamBName: nameOf(m.teamBId),
        winnerName: nameOf(m.winnerTeamId),
      }))
      .sort((a, b) => a.round - b.round || a.slot - b.slot);

    // Group standings (round robin = one group at index 0).
    const groupIndexes = [
      ...new Set(
        matches.filter((m) => m.stage === 'group').map((m) => m.groupIndex ?? 0),
      ),
    ].sort((a, b) => a - b);
    const standings = groupIndexes.map((gi) => {
      const gm = matches.filter((m) => m.stage === 'group' && (m.groupIndex ?? 0) === gi);
      const teamIds = [
        ...new Set(gm.flatMap((m) => [m.teamAId, m.teamBId].filter(Boolean) as Id<'teams'>[])),
      ];
      const rows = computeStandings(teamIds, gm).map((s) => ({
        ...s,
        name: nameOf(s.teamId) ?? '—',
      }));
      return {
        groupIndex: gi,
        label: `Group ${String.fromCharCode(65 + gi)}`,
        rows,
      };
    });

    return {
      bracket: {
        _id: bracket._id,
        format: bracket.format,
        groupCount: bracket.groupCount ?? null,
        advancePerGroup: bracket.advancePerGroup ?? null,
        knockoutSeeded: bracket.knockoutSeeded ?? false,
      },
      matches: enriched,
      standings,
      teamCount: teams.length,
    };
  },
});
