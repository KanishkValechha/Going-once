'use client';

import { teamCode } from '@/helpers/format';
import { cn } from '@/lib/utils';

export type LiveMatch = {
  _id: string;
  round: number;
  label?: string | null;
  status: 'pending' | 'ready' | 'done';
  isBye?: boolean;
  teamAName: string | null;
  teamBName: string | null;
  teamASource?: string | null;
  teamBSource?: string | null;
  scoreA?: number | null;
  scoreB?: number | null;
  winnerTeamId?: string | null;
  teamAId?: string | null;
  teamBId?: string | null;
};

/** Fixtures & results for the live client's Matches tab, grouped by round. */
export function LiveMatches({ matches }: { matches: LiveMatch[] }) {
  const playable = matches.filter((m) => !m.isBye);
  if (playable.length === 0) {
    return (
      <div className="animate-rise rounded-2xl border border-dashed border-input bg-surface px-5 py-11 text-center text-sm text-muted-foreground">
        Fixtures will appear here once the draw is made.
      </div>
    );
  }

  const upNext = playable.filter((m) => m.status === 'ready' && m.teamAId && m.teamBId).slice(0, 3);

  // Group by human round label, preserving the (round, slot)-sorted order.
  const sections: { name: string; matches: LiveMatch[] }[] = [];
  for (const m of playable) {
    const name = m.label ?? `Round ${m.round + 1}`;
    const last = sections[sections.length - 1];
    if (last && last.name === name) last.matches.push(m);
    else sections.push({ name, matches: [m] });
  }

  return (
    <div className="animate-rise flex flex-col gap-5">
      {upNext.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">
            <span className="size-[7px] animate-blink rounded-full bg-accent" />
            Coming up
          </div>
          <div className="flex flex-col gap-2.5">
            {upNext.map((m) => (
              <div key={m._id} className="rounded-2xl border border-accent bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <Side name={m.teamAName} />
                  <span className="mono text-xs font-bold text-muted-foreground/70">VS</span>
                  <Side name={m.teamBName} alignRight />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.map((s, i) => (
        <div key={i}>
          <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
            {s.name}
          </div>
          <div className="flex flex-col gap-2">
            {s.matches.map((m) => (
              <MatchRow key={m._id} match={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Side({ name, alignRight }: { name: string | null; alignRight?: boolean }) {
  return (
    <div className={cn('flex flex-1 items-center gap-2', alignRight && 'flex-row-reverse')}>
      <span className="mono flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-xs font-extrabold">
        {name ? teamCode(name) : '—'}
      </span>
      <span className={cn('truncate text-[12.5px] font-bold', alignRight && 'text-right')}>
        {name ?? 'TBD'}
      </span>
    </div>
  );
}

function MatchRow({ match: m }: { match: LiveMatch }) {
  const done = m.status === 'done';
  const aWon = done && m.winnerTeamId && m.winnerTeamId === m.teamAId;
  const bWon = done && m.winnerTeamId && m.winnerTeamId === m.teamBId;
  const aName = m.teamAName ?? m.teamASource ?? 'TBD';
  const bName = m.teamBName ?? m.teamBSource ?? 'TBD';

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-[13px] border bg-surface px-3.5 py-3',
        done ? 'border-border' : 'border-border/70',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="mono flex size-[22px] shrink-0 items-center justify-center rounded-md bg-surface-2 text-[8px] font-extrabold">
          {m.teamAName ? teamCode(m.teamAName) : '—'}
        </span>
        <span className={cn('truncate text-[13px]', aWon ? 'font-extrabold' : 'font-medium')}>
          {aName}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={cn('mono text-base font-extrabold', aWon ? 'text-accent' : '')}>
          {done ? (m.scoreA ?? 0) : '–'}
        </span>
        <span className="text-[11px] text-muted-foreground/70">:</span>
        <span className={cn('mono text-base font-extrabold', bWon ? 'text-accent' : '')}>
          {done ? (m.scoreB ?? 0) : '–'}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span
          className={cn(
            'truncate text-right text-[13px]',
            bWon ? 'font-extrabold' : 'font-medium',
          )}
        >
          {bName}
        </span>
        <span className="mono flex size-[22px] shrink-0 items-center justify-center rounded-md bg-surface-2 text-[8px] font-extrabold">
          {m.teamBName ? teamCode(m.teamBName) : '—'}
        </span>
      </div>
    </div>
  );
}
