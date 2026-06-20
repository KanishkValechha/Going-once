'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Wordmark } from '@/components/Wordmark';
import { LiveAuction } from '@/components/live/LiveAuction';
import { LiveMatches } from '@/components/live/LiveMatches';
import { LiveStandings } from '@/components/live/LiveStandings';
import { cn } from '@/lib/utils';

export default function LivePage() {
  return (
    <Suspense fallback={<Center>Loading…</Center>}>
      <LiveScreen />
    </Suspense>
  );
}

type ClientTab = 'table' | 'matches';

function LiveScreen() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const info = useQuery(api.live.phase, { token });
  const [tab, setTab] = useState<ClientTab>('table');

  if (info === undefined) return <Center>Connecting…</Center>;
  if (info.phase === 'invalid') {
    return <Center>This live link is invalid or the tournament isn&apos;t live.</Center>;
  }

  const inMatches = info.phase === 'matches' || info.phase === 'completed';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 flex h-[62px] items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl">
        <Wordmark sub={null} />
        <div className="flex-1" />
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em]',
            info.phase === 'completed'
              ? 'border-foreground/30 bg-surface-2 text-foreground'
              : 'border-accent/50 bg-accent/10 text-accent',
          )}
        >
          {info.phase !== 'completed' && (
            <span className="size-2 animate-blink rounded-full bg-accent" />
          )}
          {info.phase === 'completed' ? 'Final' : 'Live'}
        </span>
      </header>

      <main className="relative mx-auto w-full max-w-[560px] flex-1 px-3.5 pb-24 pt-4">
        <div className="mb-4.5 flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">
              Now showing
            </div>
            <div className="truncate text-lg font-black">{info.tournamentName}</div>
          </div>
        </div>

        {info.phase === 'auction' ? (
          <LiveAuction token={token} />
        ) : (
          <MatchesPhase token={token} tab={tab} champion={info.champion ?? null} />
        )}
      </main>

      {inMatches && (
        <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center border-t border-border bg-background/95 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
          <div className="flex w-full max-w-[560px] gap-1">
            <TabButton active={tab === 'table'} icon="☰" label="Table" onClick={() => setTab('table')} />
            <TabButton
              active={tab === 'matches'}
              icon="▦"
              label="Matches"
              onClick={() => setTab('matches')}
            />
          </div>
        </nav>
      )}
    </div>
  );
}

function MatchesPhase({
  token,
  tab,
  champion,
}: {
  token: string;
  tab: ClientTab;
  champion: string | null;
}) {
  const data = useQuery(api.live.bracket, { token });
  if (data === undefined) return <p className="py-20 text-center text-muted-foreground">Loading…</p>;
  if (!data.valid || !data.bracket) {
    return (
      <p className="py-20 text-center text-muted-foreground">
        Matches will appear here as soon as the draw is made.
      </p>
    );
  }

  return tab === 'table' ? (
    <LiveStandings groups={data.standings} champion={champion} />
  ) : (
    <LiveMatches matches={data.matches} />
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 transition-colors',
        active ? 'bg-surface-2 text-foreground' : 'text-muted-foreground',
      )}
    >
      <span className="text-[17px] leading-none">{icon}</span>
      <span className="text-[10.5px] font-bold tracking-[0.04em]">{label}</span>
    </button>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Wordmark size="lg" />
      <p className="text-lg text-muted-foreground">{children}</p>
    </div>
  );
}
