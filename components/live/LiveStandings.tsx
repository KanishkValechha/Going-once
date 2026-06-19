'use client';

import { teamCode } from '@/helpers/format';
import { cn } from '@/lib/utils';

export type StandingRow = {
  teamId: string;
  name: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  goalDiff: number;
  points: number;
};

export type StandingGroup = { groupIndex: number; label: string; rows: StandingRow[] };

/** League / group tables for the live client's Table tab, with a champion banner. */
export function LiveStandings({
  groups,
  champion,
}: {
  groups: StandingGroup[];
  champion: string | null;
}) {
  const anyPlayed = groups.some((g) => g.rows.some((r) => r.played > 0));

  return (
    <div className="animate-rise flex flex-col gap-5">
      {champion && (
        <div className="flex items-center gap-4 rounded-2xl border border-accent bg-surface-2 px-4.5 py-4">
          <div className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-accent [writing-mode:vertical-rl] [transform:rotate(180deg)]">
            Champions
          </div>
          <div className="w-px self-stretch bg-input" />
          <div className="text-xl font-black">{champion}</div>
        </div>
      )}

      {!anyPlayed && (
        <div className="rounded-2xl border border-dashed border-input bg-surface px-5 py-11 text-center text-sm text-muted-foreground">
          The table fills as matches are played.
        </div>
      )}

      {anyPlayed &&
        groups.map((g) => (
          <div key={g.groupIndex}>
            <div className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
              {groups.length > 1 ? g.label : 'League table'}
            </div>
            <div className="flex flex-col gap-2">
              {g.rows.map((r, i) => (
                <div
                  key={r.teamId}
                  className={cn(
                    'flex items-center gap-3 rounded-[13px] border bg-surface p-3',
                    i === 0 ? 'border-accent/50' : 'border-border',
                  )}
                >
                  <div
                    className={cn(
                      'mono w-6 text-center text-[17px] font-black',
                      i === 0 ? 'text-accent' : 'text-muted-foreground',
                    )}
                  >
                    {i + 1}
                  </div>
                  <span className="mono flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-surface-2 text-[11px] font-extrabold">
                    {teamCode(r.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-extrabold">{r.name}</div>
                    <div className="mono text-[11.5px] text-muted-foreground">
                      {r.played}P · {r.win}W · {r.draw}D · {r.loss}L ·{' '}
                      {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="mono text-[22px] font-extrabold text-accent">{r.points}</div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      pts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
