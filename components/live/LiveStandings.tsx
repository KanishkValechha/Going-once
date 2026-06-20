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

// Shared grid template so the header and every row line their columns up:
// position · team (flex) · played · won · drawn · lost · net · points.
const COLS =
  'grid grid-cols-[1.75rem_minmax(0,1fr)_2rem_2rem_2rem_2rem_2.75rem_3rem] items-center gap-x-1.5';

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

            <div className="overflow-x-auto">
              <div className="min-w-[20rem]">
                {/* Column headers */}
                <div
                  className={cn(
                    COLS,
                    'px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground',
                  )}
                >
                  <span className="text-center">#</span>
                  <span>Team</span>
                  <span className="text-center" title="Played">
                    P
                  </span>
                  <span className="text-center" title="Won">
                    W
                  </span>
                  <span className="text-center" title="Drawn">
                    D
                  </span>
                  <span className="text-center" title="Lost">
                    L
                  </span>
                  <span className="text-center" title="Net points (score margin)">
                    Net
                  </span>
                  <span className="text-right" title="Points">
                    Pts
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {g.rows.map((r, i) => (
                    <div
                      key={r.teamId}
                      className={cn(
                        COLS,
                        'rounded-[11px] border bg-surface px-3 py-2.5',
                        i === 0 ? 'border-accent/50' : 'border-border',
                      )}
                    >
                      <div
                        className={cn(
                          'mono text-center text-[15px] font-black',
                          i === 0 ? 'text-accent' : 'text-muted-foreground',
                        )}
                      >
                        {i + 1}
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="mono flex size-[30px] shrink-0 items-center justify-center rounded-[8px] bg-surface-2 text-[10.5px] font-extrabold">
                          {teamCode(r.name)}
                        </span>
                        <span className="truncate text-[14px] font-extrabold">{r.name}</span>
                      </div>
                      <Cell>{r.played}</Cell>
                      <Cell>{r.win}</Cell>
                      <Cell>{r.draw}</Cell>
                      <Cell>{r.loss}</Cell>
                      <Cell muted>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</Cell>
                      <div className="mono text-right text-[19px] font-extrabold text-accent tabular-nums">
                        {r.points}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}

function Cell({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      className={cn(
        'mono text-center text-[13.5px] font-bold tabular-nums',
        muted ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {children}
    </div>
  );
}
