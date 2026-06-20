'use client';

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import { formatAmount, teamCode } from '@/helpers/format';
import { AvatarImage } from '@/components/ui/avatar-image';
import { cn } from '@/lib/utils';
import { RosterSheet, type RosterTeam } from './RosterSheet';

type Ticker = FunctionReturnType<typeof api.auction.liveTicker>;
type Board = Extract<FunctionReturnType<typeof api.auction.liveBoard>, { valid: true }>;

/** Auction stage of the live client: the lot on the block + squads to browse. */
export function LiveAuction({ token }: { token: string }) {
  const ticker = useQuery(api.auction.liveTicker, { token });
  const board = useQuery(api.auction.liveBoard, { token });
  const [openTeam, setOpenTeam] = useState<RosterTeam | null>(null);

  if (ticker === undefined || board === undefined || !board.valid) {
    return <p className="py-20 text-center text-muted-foreground">Loading the auction…</p>;
  }

  return (
    <div className="animate-rise">
      <LotCard ticker={ticker} />

      <div className="mt-6">
        <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          Squads · tap to view roster
        </p>
        <div className="flex flex-col gap-2.5">
          {board.teams.map((t) => (
            <SquadRow
              key={t._id}
              team={t}
              onOpen={() =>
                setOpenTeam({
                  name: t.name,
                  remainingBudget: t.remainingBudget,
                  members: t.roster.map((p) => ({ name: p.name, price: p.soldPrice })),
                })
              }
            />
          ))}
        </div>
      </div>

      {openTeam && <RosterSheet team={openTeam} onClose={() => setOpenTeam(null)} />}
    </div>
  );
}

function LotCard({ ticker }: { ticker: Ticker }) {
  if (ticker.phase === 'idle' || ticker.phase === 'invalid') {
    return (
      <div className="rounded-[22px] border border-border bg-surface px-6 py-11 text-center text-muted-foreground">
        <div className="mb-3 text-3xl font-black tracking-tight text-foreground">Going Once</div>
        <div className="text-base font-bold text-foreground/80">Waiting for the next lot</div>
        <div className="mt-2 text-[13px]">The auctioneer is lining up the next player.</div>
      </div>
    );
  }

  const player = ticker.player;
  const isResult = ticker.phase === 'result';
  const sold = isResult && ticker.sold;
  const dotLabel = isResult ? (sold ? 'SOLD' : 'UNSOLD') : 'BIDDING OPEN';

  return (
    <div>
      <div className="mb-3.5 flex items-center gap-2">
        <span className="size-2 animate-blink rounded-full bg-accent" />
        <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-accent">
          {dotLabel}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-[22px] border border-border bg-surface px-5 py-6">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="relative">
            <AvatarImage
              src={player?.imageUrl}
              name={player?.name ?? '?'}
              className="size-[104px] rounded-3xl text-4xl"
            />
            {!isResult && (
              <span className="absolute -inset-1.5 animate-ring-pulse rounded-[28px] border-2 border-accent opacity-40" />
            )}
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight">{player?.name}</div>
          <div className="text-[13px] font-semibold text-muted-foreground">
            {player?.role ? `${player.role} · ` : ''}Min {formatAmount(player?.minBid)}
          </div>
        </div>

        {!isResult && (
          <>
            <div className="mt-5 text-center">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Current bid · points
              </div>
              <div
                key={ticker.currentBid ?? 0}
                className="mono animate-bid-pop text-5xl font-extrabold leading-none text-accent"
              >
                {formatAmount(ticker.currentBid)}
              </div>
            </div>
            {ticker.leadingTeam ? (
              <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-foreground/80 bg-surface-2 p-3">
                <AvatarImage
                  src={ticker.leadingTeam.logoUrl}
                  name={ticker.leadingTeam.name}
                  className="size-9 rounded-[10px] text-xs"
                />
                <div className="text-left">
                  <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Highest bidder
                  </div>
                  <div className="text-[15px] font-extrabold">{ticker.leadingTeam.name}</div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-center text-sm text-muted-foreground">Awaiting first bid…</p>
            )}
          </>
        )}

        {/* SOLD / UNSOLD stamp overlay */}
        {isResult && (
          <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2 overflow-hidden bg-background/95 backdrop-blur-[2px]">
            {sold ? (
              <>
                <div className="animate-slam text-[clamp(64px,22vw,96px)] font-black tracking-tighter text-foreground">
                  SOLD
                </div>
                <div className="px-5 text-center text-base font-extrabold">
                  {ticker.player?.name} → {ticker.soldTeam?.name}
                </div>
                <div className="mono text-2xl font-extrabold text-accent">
                  {formatAmount(ticker.soldPrice)} pts
                </div>
              </>
            ) : (
              <div className="animate-slam rounded-xl border-4 border-muted-foreground px-5 py-1 text-[clamp(44px,14vw,68px)] font-black text-muted-foreground">
                UNSOLD
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SquadRow({ team, onOpen }: { team: Board['teams'][number]; onOpen: () => void }) {
  const preview = team.roster.slice(0, 3);
  return (
    <button
      onClick={onOpen}
      className="rounded-[13px] border border-border bg-surface p-3.5 text-left transition-colors hover:border-input"
    >
      <div className="flex items-center gap-3">
        <span className="mono flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-surface-2 text-[11px] font-extrabold">
          {teamCode(team.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-extrabold">{team.name}</div>
          <div className="text-[11.5px] text-muted-foreground">
            {team.playersWon} players · {formatAmount(team.remainingBudget)} pts left
          </div>
        </div>
        <span className="text-lg text-muted-foreground/70">›</span>
      </div>
      {preview.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {preview.map((p, i) => (
            <span
              key={i}
              className={cn(
                'rounded-[7px] border border-border bg-surface-2 px-2 py-1 text-[11px] font-semibold text-foreground/80',
              )}
            >
              {p.name}
            </span>
          ))}
          {team.roster.length > 3 && (
            <span className="rounded-[7px] px-2 py-1 text-[11px] font-semibold text-muted-foreground">
              +{team.roster.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
