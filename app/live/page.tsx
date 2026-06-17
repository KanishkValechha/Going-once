'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import { formatAmount, remainingSlots } from '@/helpers/format';

type Ticker = Extract<FunctionReturnType<typeof api.auction.liveTicker>, { phase: 'bidding' }>;
type Board = Extract<FunctionReturnType<typeof api.auction.liveBoard>, { valid: true }>;

export default function LivePage() {
  return (
    <Suspense fallback={<Center>Loading…</Center>}>
      <LiveScreen />
    </Suspense>
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
        <span className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">Going Once</span>
        <h1 className="text-xl font-semibold text-muted">{board.tournamentName}</h1>
      </header>

      {ticker.phase === 'bidding' ? (
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <ActivePanel ticker={ticker} />
          <TeamBoard board={board} compact />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="text-2xl font-semibold text-muted">Waiting for the next player…</p>
          </div>
          <TeamBoard board={board} />
        </div>
      )}
    </div>
  );
}

function ActivePanel({ ticker }: { ticker: Ticker }) {
  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-8">
      <div className="flex items-center gap-6">
        {ticker.player?.imageUrl ? (
          <img src={ticker.player.imageUrl} alt="" className="h-32 w-32 rounded-2xl object-cover" />
        ) : (
          <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-surface-2 text-5xl text-muted">
            {ticker.player?.name.charAt(0) ?? '?'}
          </div>
        )}
        <div>
          <p className="text-sm uppercase tracking-wide text-muted">Now on the block</p>
          <h2 className="text-5xl font-bold">{ticker.player?.name}</h2>
          <p className="mt-2 text-lg text-muted">
            {ticker.player?.role ? `${ticker.player.role} · ` : ''}base {formatAmount(ticker.player?.basePrice)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-surface-2 p-8 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-muted">Current bid</p>
        <p className="tnum my-2 text-7xl font-black text-accent lg:text-8xl">{formatAmount(ticker.currentBid)}</p>
        <p className="text-2xl font-semibold">
          {ticker.leadingTeam ? (
            <span className="inline-flex items-center gap-3">
              {ticker.leadingTeam.logoUrl && (
                <img src={ticker.leadingTeam.logoUrl} alt="" className="h-8 w-8 rounded-md object-cover" />
              )}
              {ticker.leadingTeam.name}
            </span>
          ) : (
            <span className="text-muted">Awaiting first bid</span>
          )}
        </p>
      </div>
    </div>
  );
}

function TeamBoard({ board, compact = false }: { board: Board; compact?: boolean }) {
  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
      {board.teams.map((t) => (
        <div key={t._id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
          {t.logoUrl ? (
            <img src={t.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-muted">
              {t.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{t.name}</p>
            <p className="text-xs text-muted">
              {t.playersWon} / {board.rosterSize} · {remainingSlots(board.rosterSize, t.playersWon)} slots left
            </p>
            {!compact && t.roster.length > 0 && (
              <p className="mt-1 truncate text-xs text-muted">
                {t.roster.map((p) => p.name).join(', ')}
              </p>
            )}
          </div>
          <p
            className={`tnum text-right text-lg font-bold ${
              t.budgetStatus === 'low' ? 'text-warning' : t.budgetStatus === 'out' ? 'text-muted' : 'text-accent'
            }`}
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
    <div className="flex min-h-screen items-center justify-center px-6 text-center text-xl text-muted">{children}</div>
  );
}
