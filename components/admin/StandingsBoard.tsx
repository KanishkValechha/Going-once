'use client';

import { useQuery } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { Trophy } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/types';
import { Spinner } from '@/components/ui/spinner';
import { LiveStandings } from '@/components/live/LiveStandings';

type ViewData = NonNullable<FunctionReturnType<typeof api.bracket.view>>;

/** Champion = top of the league table, or the winner of the knockout final. */
function findChampion(data: ViewData): string | null {
  if (data.bracket.format === 'round_robin' || data.bracket.format === 'double_round_robin') {
    const rows = data.standings[0]?.rows;
    return rows && rows.length > 0 && rows[0].played > 0 ? rows[0].name : null;
  }
  const knockout = data.matches.filter((m) => m.stage === 'knockout');
  if (knockout.length === 0) return null;
  const maxRound = Math.max(...knockout.map((m) => m.round));
  const final = knockout.find((m) => m.round === maxRound);
  return final?.status === 'done' ? final.winnerName : null;
}

export function StandingsBoard({ tournamentId }: { tournamentId: Id<'tournaments'> }) {
  const data = useQuery(api.bracket.view, { tournamentId });

  if (data === undefined) return <Spinner label="Loading standings…" />;
  if (data === null) {
    return (
      <div className="rounded-2xl border border-dashed border-input bg-surface px-5 py-12 text-center text-sm text-muted-foreground">
        Draw the fixtures in the <b className="text-foreground">Fixtures</b> tab to build the table.
      </div>
    );
  }

  const champion = findChampion(data);
  const hasTable = data.standings.some((g) => g.rows.length > 0);

  if (!hasTable) {
    // Pure knockout — there's no league table; point at the bracket.
    return (
      <div className="flex flex-col gap-4">
        {champion && <ChampionBanner name={champion} />}
        <div className="rounded-2xl border border-dashed border-input bg-surface px-5 py-12 text-center text-sm text-muted-foreground">
          This is a knockout format — follow the bracket in the{' '}
          <b className="text-foreground">Fixtures</b> tab.
        </div>
      </div>
    );
  }

  return <LiveStandings groups={data.standings} champion={champion} />;
}

function ChampionBanner({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent bg-surface-2 px-5 py-4">
      <Trophy className="size-5 text-accent" />
      <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-accent">
        Champions
      </span>
      <span className="text-xl font-black">{name}</span>
    </div>
  );
}
