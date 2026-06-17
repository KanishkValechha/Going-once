'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import { formatAmount } from '@/helpers/format';
import { AvatarImage } from '@/components/ui/avatar-image';
import { Wordmark } from '@/components/Wordmark';
import { cn } from '@/lib/utils';

type Ticker = Extract<FunctionReturnType<typeof api.auction.liveTicker>, { phase: 'bidding' }>;
type Board = Extract<FunctionReturnType<typeof api.auction.liveBoard>, { valid: true }>;
type Team = Board['teams'][number];

export default function LivePage() {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<Center>Loading…</Center>}>
        <LiveScreen />
      </Suspense>
    </div>
  );
}

function LiveScreen() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const ticker = useQuery(api.auction.liveTicker, { token });
  const board = useQuery(api.auction.liveBoard, { token });

  if (ticker === undefined || board === undefined) return <Center>Connecting…</Center>;
  if (ticker.phase === 'invalid' || !board.valid) {
    return <Center>This live link is invalid or the tournament isn&apos;t live.</Center>;
  }

  // Firepower order: who still has the most to spend leads the board.
  const teams = [...board.teams].sort((a, b) => b.remainingBudget - a.remainingBudget);
  const bidding = ticker.phase === 'bidding';

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-5 py-6 sm:px-8 lg:py-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 lg:mb-9">
        <div className="flex items-center gap-4">
          <Wordmark size="lg" />
          <span className="hidden h-8 w-px bg-border sm:block" />
          <span className="hidden text-base font-semibold text-muted-foreground sm:block">
            {board.tournamentName}
          </span>
        </div>
        <LivePill />
      </header>

      {bidding ? (
        <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
          <ActivePanel ticker={ticker} />
          <Standings teams={teams} rosterSize={board.rosterSize} />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <BetweenLots />
          <Standings teams={teams} rosterSize={board.rosterSize} layout="grid" />
        </div>
      )}
    </div>
  );
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-live/40 bg-live/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-live">
      <span className="size-2 animate-live-pulse rounded-full bg-live" />
      Live
    </span>
  );
}

function ActivePanel({ ticker }: { ticker: Ticker }) {
  return (
    // Keyed on the player so a new lot re-plays the reveal.
    <section
      key={ticker.player?.name ?? 'lot'}
      className="animate-rise flex flex-col rounded-3xl border border-border bg-surface p-6 sm:p-8 lg:p-10"
    >
      <div className="flex items-center gap-5">
        <AvatarImage
          src={ticker.player?.imageUrl}
          name={ticker.player?.name ?? '?'}
          className="size-24 rounded-2xl text-5xl sm:size-28"
        />
        <div className="min-w-0">
          <p className="eyebrow">On the block</p>
          <h2 className="display mt-1.5 truncate text-4xl sm:text-5xl lg:text-6xl">
            {ticker.player?.name}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {ticker.player?.role ? `${ticker.player.role} · ` : ''}
            Base {formatAmount(ticker.player?.basePrice)}
          </p>
        </div>
      </div>

      <div className="my-8 h-px bg-border lg:my-10" />

      <div>
        <p className="eyebrow">Current bid</p>
        <p
          key={ticker.currentBid ?? 0}
          className="tnum display my-1 animate-bid-pop text-7xl text-accent sm:text-8xl lg:text-9xl"
        >
          {formatAmount(ticker.currentBid)}
        </p>
        {ticker.leadingTeam ? (
          <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-border bg-surface-2 py-2 pl-2 pr-4">
            <AvatarImage
              src={ticker.leadingTeam.logoUrl}
              name={ticker.leadingTeam.name}
              className="size-8 rounded-lg"
            />
            <span className="font-semibold">{ticker.leadingTeam.name}</span>
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-accent">leading</span>
          </div>
        ) : (
          <p className="mt-5 text-lg text-muted-foreground">Awaiting first bid…</p>
        )}
      </div>
    </section>
  );
}

function Standings({
  teams,
  rosterSize,
  layout = 'list',
}: {
  teams: Team[];
  rosterSize: number;
  layout?: 'list' | 'grid';
}) {
  return (
    <section className="animate-rise rounded-3xl border border-border bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="display text-xl">Standings</h3>
        <span className="eyebrow">{teams.length} teams</span>
      </div>
      <div
        className={cn(
          'gap-2',
          layout === 'grid' ? 'grid sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col',
        )}
      >
        {teams.map((t, i) => (
          <TeamRow key={t._id} team={t} rank={i + 1} rosterSize={rosterSize} showRoster={layout === 'grid'} />
        ))}
      </div>
    </section>
  );
}

function TeamRow({
  team,
  rank,
  rosterSize,
  showRoster,
}: {
  team: Team;
  rank: number;
  rosterSize: number;
  showRoster: boolean;
}) {
  const pct = rosterSize > 0 ? Math.min(100, (team.playersWon / rosterSize) * 100) : 0;
  const full = team.playersWon >= rosterSize;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2/40 px-3.5 py-3">
      <span className="tnum w-5 shrink-0 text-center text-sm font-bold text-muted-foreground">{rank}</span>
      <AvatarImage src={team.logoUrl} name={team.name} className="size-10 rounded-lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-semibold">{team.name}</p>
          <p
            className={cn(
              'tnum shrink-0 font-bold tabular-nums',
              team.budgetStatus === 'low'
                ? 'text-warning'
                : team.budgetStatus === 'out'
                  ? 'text-muted-foreground'
                  : 'text-foreground',
            )}
          >
            {formatAmount(team.remainingBudget)}
          </p>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className={cn('h-full rounded-full', full ? 'bg-positive' : 'bg-accent')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="tnum shrink-0 text-xs text-muted-foreground">
            {team.playersWon}/{rosterSize}
          </span>
        </div>
        {showRoster && team.roster.length > 0 && (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {team.roster.map((p) => p.name).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}

function BetweenLots() {
  return (
    <section className="animate-rise flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface py-14 text-center lg:py-16">
      <span className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2.5 animate-bounce rounded-full bg-accent/70"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <p className="display text-3xl sm:text-4xl">Waiting for the next player</p>
      <p className="text-muted-foreground">The standings below update as lots are sold.</p>
    </section>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Wordmark size="lg" />
      <p className="text-xl text-muted-foreground">{children}</p>
    </div>
  );
}
