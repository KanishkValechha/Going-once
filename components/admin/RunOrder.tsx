'use client';

import { Check } from 'lucide-react';
import { formatAmount } from '@/helpers/format';
import type { Progress } from '@/helpers/tournament';
import { cn } from '@/lib/utils';

export type WorkspaceTab =
  | 'overview'
  | 'teams'
  | 'players'
  | 'captains'
  | 'auction'
  | 'fixtures'
  | 'standings'
  | 'members';

type NextStep = { n: string; title: string; cta: string; tab: WorkspaceTab };

function nextStep(p: Progress): NextStep {
  if (p.teamCount < 2)
    return { n: '1', title: 'Add at least two teams to compete.', cta: 'Add teams', tab: 'teams' };
  if (p.playerCount === 0)
    return { n: '2', title: 'Register players into the auction pool.', cta: 'Add players', tab: 'players' };
  if (p.poolCount > 0)
    return {
      n: '3',
      title: `${p.poolCount} player${p.poolCount > 1 ? 's' : ''} still in the pool — run the auction.`,
      cta: 'Open auction',
      tab: 'auction',
    };
  if (p.matchCount === 0)
    return { n: '4', title: 'Auction done. Generate the match schedule.', cta: 'Generate fixtures', tab: 'fixtures' };
  if (p.finalsCount < p.playableCount) {
    const left = p.playableCount - p.finalsCount;
    return {
      n: '5',
      title: `${left} match${left > 1 ? 'es' : ''} left to play.`,
      cta: 'Go to matches',
      tab: 'fixtures',
    };
  }
  return { n: '✓', title: 'Tournament complete — view the final table.', cta: 'See standings', tab: 'standings' };
}

/** The "what to do next" banner shown above the workspace tabs. */
export function NextStepBanner({
  progress,
  onNavigate,
}: {
  progress: Progress;
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const s = nextStep(progress);
  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-border bg-surface px-4 py-3.5">
      <div className="mono flex size-[30px] shrink-0 items-center justify-center rounded-lg border border-input bg-surface-2 text-xs font-extrabold text-accent">
        {s.n}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
          Next step
        </div>
        <div className="mt-0.5 text-[14.5px] font-bold">{s.title}</div>
      </div>
      <button
        onClick={() => onNavigate(s.tab)}
        className="shrink-0 whitespace-nowrap rounded-[10px] bg-foreground px-4.5 py-2.5 text-[13.5px] font-bold text-background transition-[filter] hover:brightness-110"
      >
        {s.cta}
      </button>
    </div>
  );
}

/** Headline stats + the five-step run order for the Overview tab. */
export function RunOrderBoard({
  progress: p,
  onNavigate,
}: {
  progress: Progress;
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const stats = [
    { label: 'Teams', value: String(p.teamCount), sub: 'competing squads' },
    { label: 'Players sold', value: `${p.soldCount}/${p.playerCount}`, sub: 'in the auction' },
    { label: 'Points spent', value: formatAmount(p.spent), sub: 'across all squads', accent: true },
    { label: 'Matches', value: String(p.matchCount), sub: `${p.finalsCount} completed` },
  ];

  const aucDone = p.playerCount > 0 && p.poolCount === 0;
  const curIdx =
    p.teamCount > 0 && p.playerCount > 0 && p.poolCount === 0
      ? p.matchCount === 0
        ? 3
        : p.finalsCount < p.playableCount
          ? 4
          : 5
      : p.teamCount > 0
        ? p.playerCount > 0
          ? 2
          : 1
        : 0;

  const steps: { title: string; desc: string; cta: string; tab: WorkspaceTab; done: boolean; active: boolean }[] = [
    { title: 'Build the teams', desc: 'Register squads, captains and purse.', cta: 'Teams', tab: 'teams', done: p.teamCount > 0, active: curIdx === 0 },
    { title: 'Register players', desc: 'Add the player pool with base prices.', cta: 'Players', tab: 'players', done: p.playerCount > 0, active: curIdx === 1 },
    { title: 'Run the auction', desc: 'Sell every player to the highest bidder.', cta: 'Auction', tab: 'auction', done: aucDone, active: curIdx === 2 },
    { title: 'Generate fixtures', desc: 'Build the schedule from your format.', cta: 'Fixtures', tab: 'fixtures', done: p.matchCount > 0, active: curIdx === 3 },
    { title: 'Host & track', desc: 'Record scores and crown the champions.', cta: 'Standings', tab: 'standings', done: p.playableCount > 0 && p.finalsCount === p.playableCount, active: curIdx === 4 || curIdx === 5 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-surface p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {s.label}
            </div>
            <div className={cn('mono mt-2 text-2xl font-extrabold', s.accent && 'text-accent')}>
              {s.value}
            </div>
            <div className="mt-1 text-[11.5px] text-muted-foreground/80">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="text-[15px] font-extrabold">Run order</div>
        <div className="mb-5 mt-1 text-[13px] text-muted-foreground">
          The flow from setup to champions — the current step is highlighted.
        </div>
        <div className="flex flex-col">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3.5">
              <div className="flex flex-col items-center self-stretch">
                <div
                  className={cn(
                    'mono flex size-[30px] shrink-0 items-center justify-center rounded-full border text-[13px] font-extrabold',
                    step.done
                      ? 'border-foreground bg-foreground text-background'
                      : step.active
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-input bg-surface-2 text-muted-foreground',
                  )}
                >
                  {step.done ? <Check className="size-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && <div className="my-1 min-h-3.5 w-0.5 flex-1 bg-border" />}
              </div>
              <div className="flex-1 pb-4.5">
                <div className={cn('text-[14.5px] font-bold', step.active && 'text-accent')}>
                  {step.title}
                </div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {step.desc}
                </div>
              </div>
              <button
                onClick={() => onNavigate(step.tab)}
                className="shrink-0 whitespace-nowrap rounded-[9px] border border-input bg-surface-2 px-3.5 py-2 text-[12.5px] font-bold text-foreground/80 transition-colors hover:text-foreground"
              >
                {step.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
