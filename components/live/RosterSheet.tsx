'use client';

import { formatAmount, initials, teamCode } from '@/helpers/format';

export type RosterMember = { name: string; role?: string | null; price?: number | null };

export type RosterTeam = {
  name: string;
  remainingBudget?: number;
  spent?: number;
  members: RosterMember[];
};

/** Tap-to-view squad roster, sliding up from the bottom on the live client. */
export function RosterSheet({ team, onClose }: { team: RosterTeam; onClose: () => void }) {
  const code = teamCode(team.name);
  const count = team.members.length;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-[3px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet max-h-[84vh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl border border-border bg-surface"
      >
        <div className="sticky top-0 border-b border-border bg-surface px-5 pb-3.5 pt-4">
          <div className="mx-auto mb-3.5 h-1 w-9 rounded bg-input" />
          <div className="flex items-center gap-3">
            <span className="mono flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-sm font-extrabold">
              {code}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-black">{team.name}</div>
              <div className="text-xs text-muted-foreground">{count} players</div>
            </div>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-lg border border-input bg-surface-2 text-base text-muted-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="mt-3.5 flex gap-5">
            {team.remainingBudget !== undefined && (
              <Stat label="PTS LEFT" value={formatAmount(team.remainingBudget)} accent />
            )}
            {team.spent !== undefined && <Stat label="PTS SPENT" value={formatAmount(team.spent)} />}
            <Stat label="PLAYERS" value={String(count)} />
          </div>
        </div>
        <div className="px-5 pb-7 pt-4">
          {count === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground/80">
              No players bought yet.
            </div>
          ) : (
            team.members.map((m, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-surface-2 py-2.5">
                <span className="mono flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-[13px] font-extrabold text-muted-foreground">
                  {initials(m.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{m.name}</div>
                  {m.role && <div className="text-xs text-muted-foreground">{m.role}</div>}
                </div>
                {m.price != null && (
                  <div className="mono text-sm font-extrabold text-accent">
                    {formatAmount(m.price)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={`mono text-lg font-extrabold ${accent ? 'text-accent' : ''}`}>{value}</div>
      <div className="mt-px text-[10px] tracking-[0.06em] text-muted-foreground">{label}</div>
    </div>
  );
}
