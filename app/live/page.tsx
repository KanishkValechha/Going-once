'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import { formatAmount, remainingSlots } from '@/helpers/format';
import { AvatarImage } from '@/components/ui/avatar-image';
import { Wordmark } from '@/components/Wordmark';
import { cn } from '@/lib/utils';

type Ticker = Extract<FunctionReturnType<typeof api.auction.liveTicker>, { phase: 'bidding' }>;
type Board = Extract<FunctionReturnType<typeof api.auction.liveBoard>, { valid: true }>;

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

  return (
    <div className="min-h-screen p-6 lg:p-10">
      <header className="mb-8 flex items-center justify-between">
        <Wordmark size="lg" />
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-full border border-live/50 bg-live/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-live">
            <span className="size-2 animate-live-pulse rounded-full bg-live" /> Live
          </span>
          <h1 className="display text-2xl text-muted-foreground">{board.tournamentName}</h1>
        </div>
      </header>

      {ticker.phase === 'bidding' ? (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <ActivePanel ticker={ticker} />
          <TeamBoard board={board} compact />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-surface py-20 text-center">
            <span className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-2.5 animate-bounce rounded-full bg-accent/70"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
            <p className="display text-4xl">Waiting for the next player</p>
          </div>
          <TeamBoard board={board} />
        </div>
      )}
    </div>
  );
}

function ActivePanel({ ticker }: { ticker: Ticker }) {
  return (
    <div className="flex flex-col gap-8 rounded-3xl border border-border bg-surface p-8 lg:p-10">
      <div className="flex items-center gap-6">
        <AvatarImage
          src={ticker.player?.imageUrl}
          name={ticker.player?.name ?? '?'}
          className="size-32 rounded-3xl text-6xl"
        />
        <div>
          <p className="eyebrow">Now on the block</p>
          <h2 className="display text-6xl lg:text-7xl">{ticker.player?.name}</h2>
          <p className="mt-2 text-lg text-muted-foreground">
            {ticker.player?.role ? `${ticker.player.role} · ` : ''}base {formatAmount(ticker.player?.basePrice)}
          </p>
        </div>
      </div>

      <div className="relative rounded-3xl border border-border bg-surface-2/70 p-8 text-center lg:p-10">
        <p className="eyebrow">Current bid</p>
        <p
          key={ticker.currentBid ?? 0}
          className="tnum display my-3 animate-bid-pop text-8xl text-accent lg:text-9xl"
        >
          {formatAmount(ticker.currentBid)}
        </p>
        <p className="text-2xl font-semibold">
          {ticker.leadingTeam ? (
            <span className="inline-flex items-center gap-3">
              {ticker.leadingTeam.logoUrl && (
                <AvatarImage src={ticker.leadingTeam.logoUrl} name={ticker.leadingTeam.name} className="size-9 rounded-lg" />
              )}
              {ticker.leadingTeam.name}
            </span>
          ) : (
            <span className="text-muted-foreground">Awaiting first bid</span>
          )}
        </p>
      </div>
    </div>
  );
}

function TeamBoard({ board, compact = false }: { board: Board; compact?: boolean }) {
  return (
    <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3')}>
      {board.teams.map((t) => (
        <div
          key={t._id}
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors"
        >
          <AvatarImage src={t.logoUrl} name={t.name} className="size-11 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{t.name}</p>
            <p className="text-xs text-muted-foreground">
              {t.playersWon} / {board.rosterSize} · {remainingSlots(board.rosterSize, t.playersWon)} slots left
            </p>
            {!compact && t.roster.length > 0 && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {t.roster.map((p) => p.name).join(', ')}
              </p>
            )}
          </div>
          <p
            className={cn(
              'tnum display text-right text-2xl',
              t.budgetStatus === 'low'
                ? 'text-warning'
                : t.budgetStatus === 'out'
                  ? 'text-muted-foreground'
                  : 'text-accent',
            )}
          >
            {formatAmount(t.remainingBudget)}
          </p>
        </div>
      ))}
    </div>
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
