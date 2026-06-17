'use client';

import { use } from 'react';
import Link from 'next/link';
import { useAtom } from 'jotai';
import { useMutation, useQuery } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { ArrowLeft, ArrowRight, Check, ExternalLink, RotateCcw, Shuffle, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AvatarImage } from '@/components/ui/avatar-image';
import { formatAmount } from '@/helpers/format';
import { buildLiveUrl } from '@/helpers/live';
import { nextBid } from '@/convex/lib/increment';
import { cn } from '@/lib/utils';
import { overrideBidAtom, pendingActionAtom } from '@/jotai/auction';

export default function AuctionConsolePage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params);
  const id = tournamentId as Id<'tournaments'>;
  const state = useQuery(api.auction.consoleState, { tournamentId: id });
  const resetAuction = useMutation(api.auction.resetAuction);

  async function reset() {
    if (
      !confirm(
        'Reset the auction? Every player returns to the pool and all team budgets are restored. ' +
          'Teams and players you added stay — only the auction results are cleared.',
      )
    )
      return;
    try {
      await resetAuction({ tournamentId: id });
      toast.success('Auction reset — every player is back in the pool.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not reset the auction');
    }
  }

  if (state === undefined) return <Spinner label="Loading console…" />;
  if (state === null) return <p className="text-muted-foreground">Tournament not found.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/${tournamentId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> {state.tournament.name}
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="display text-3xl">Auction Console</h1>
            <Badge variant={state.tournament.status === 'live' ? 'live' : 'neutral'}>
              {state.tournament.status === 'live' && (
                <span className="size-1.5 animate-live-pulse rounded-full bg-live" />
              )}
              {state.tournament.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => void reset()}>
              <RotateCcw className="size-4" /> Reset auction
            </Button>
            <a href={buildLiveUrl(state.tournament.viewerToken)} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="size-4" /> Live screen
              </Button>
            </a>
          </div>
        </div>
      </div>

      {state.tournament.status !== 'live' && (
        <Card className="border-warning/40 bg-warning/5 p-4 text-sm text-muted-foreground">
          This tournament isn&apos;t live yet — the public screen won&apos;t show it. Go live from the tournament
          Overview tab.
        </Card>
      )}

      <RosterProgress state={state} />

      {state.phase === 'bidding' ? (
        <ActiveLot tournamentId={id} state={state} />
      ) : state.phase === 'result' ? (
        <ResultLot tournamentId={id} state={state} />
      ) : (
        <SelectPlayer tournamentId={id} />
      )}

      <TeamRosters teams={state.teams} rosterSize={state.tournament.rosterSize} />
    </div>
  );
}

type ConsoleState = NonNullable<FunctionReturnType<typeof api.auction.consoleState>>;

function RosterProgress({ state }: { state: ConsoleState }) {
  const { teamsFull, teamCount, rostersComplete, availablePlayers } = state;
  return (
    <Card
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 p-4 text-sm',
        rostersComplete && 'border-positive/40',
      )}
    >
      <span className="flex items-center gap-2.5">
        <Badge variant={rostersComplete ? 'positive' : 'neutral'}>
          {teamsFull}/{teamCount} rosters full
        </Badge>
        {rostersComplete ? (
          <span className="text-positive">All teams have enough players — you can mark the tournament completed.</span>
        ) : (
          <span className="text-muted-foreground">Keep the auction going until every team fills its roster.</span>
        )}
      </span>
      {!rostersComplete && availablePlayers === 0 && (
        <span className="text-warning">No available players left — re-auction the unsold ones to finish rosters.</span>
      )}
    </Card>
  );
}

function ActiveLot({ tournamentId, state }: { tournamentId: Id<'tournaments'>; state: ConsoleState }) {
  const placeBid = useMutation(api.auction.placeBid);
  const undoBid = useMutation(api.auction.undoBid);
  const markSold = useMutation(api.auction.markSold);
  const markUnsold = useMutation(api.auction.markUnsold);
  const [override, setOverride] = useAtom(overrideBidAtom);
  const [pending, setPending] = useAtom(pendingActionAtom);

  const player = state.activePlayer;
  if (!player) return <Spinner />;

  const prospectiveBid = nextBid(state.currentBid ?? undefined, player.minBid, state.tournament.minBidIncrement);

  function bid(teamId: Id<'teams'>) {
    void placeBid({ tournamentId, teamId, expectedBidCount: state.bidCount });
  }

  function bidOverride(teamId: Id<'teams'>) {
    const amount = Number(override);
    if (!amount) return;
    void placeBid({ tournamentId, teamId, overrideAmount: amount, expectedBidCount: state.bidCount }).then(() =>
      setOverride(''),
    );
  }

  const leadingTeam = state.teams.find((t) => t._id === state.leadingTeamId);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
      {/* Active lot */}
      <Card className="flex flex-col gap-5 p-6">
        <div className="flex items-center gap-4">
          <AvatarImage src={player.imageUrl} name={player.name} className="size-20 rounded-2xl text-3xl" />
          <div>
            <p className="eyebrow">Now on the block</p>
            <h2 className="display text-3xl">{player.name}</h2>
            <p className="text-sm text-muted-foreground">
              {player.role ? `${player.role} · ` : ''}min {formatAmount(player.minBid)}
            </p>
          </div>
        </div>

        <div className="relative rounded-2xl border border-border bg-surface-2/60 p-6 text-center">
          <p className="eyebrow">Current bid</p>
          <p
            key={`${state.bidCount}-${state.currentBid}`}
            className="tnum display my-1 animate-bid-pop text-6xl text-accent"
          >
            {formatAmount(state.currentBid)}
          </p>
          <p className="text-sm font-semibold">
            {leadingTeam ? (
              <span className="text-foreground">Leading: {leadingTeam.name}</span>
            ) : (
              <span className="text-muted-foreground">No bids yet</span>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Input
            type="number"
            placeholder="Manual override amount"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Next auto bid <span className="tnum text-foreground">{formatAmount(prospectiveBid)}</span>. Enter an amount
            to register an exact bid instead.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={() => void undoBid({ tournamentId })} disabled={state.bidCount === 0}>
            <Undo2 className="size-4" /> Undo
          </Button>
          <Button variant="destructive" onClick={() => setPending(pending === 'unsold' ? null : 'unsold')}>
            <X className="size-4" /> Unsold
          </Button>
          <Button onClick={() => setPending(pending === 'sold' ? null : 'sold')} disabled={!state.leadingTeamId}>
            <Check className="size-4" /> Sold
          </Button>
        </div>

        {pending && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/40 bg-surface-2 p-3 text-sm">
            <span>
              {pending === 'sold'
                ? `Sell to ${leadingTeam?.name} for ${formatAmount(state.currentBid)}?`
                : 'Mark this player unsold?'}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const action = pending === 'sold' ? markSold({ tournamentId }) : markUnsold({ tournamentId });
                  void action
                    .then(() => {
                      toast.success(pending === 'sold' ? `Sold to ${leadingTeam?.name}` : 'Marked unsold');
                      setPending(null);
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : 'Action failed'));
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Team bid buttons */}
      <div className="flex flex-col gap-3">
        <p className="eyebrow">Tap a team when they raise their hand</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {state.teams.map((t) => {
            const useOverride = Number(override) > 0;
            const intendedBid = useOverride ? Number(override) : prospectiveBid;
            const cannotAfford = intendedBid > t.maxBid;
            const isLeading = t._id === state.leadingTeamId;
            return (
              <button
                key={t._id}
                disabled={cannotAfford}
                onClick={() => (useOverride ? bidOverride(t._id) : bid(t._id))}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-xl border p-4 text-left transition-all active:scale-[0.98]',
                  isLeading
                    ? 'border-accent bg-accent/10'
                    : cannotAfford
                      ? 'cursor-not-allowed border-destructive/30 bg-destructive/5 opacity-60'
                      : 'border-border bg-surface hover:-translate-y-0.5 hover:border-accent/60',
                )}
              >
                <span className="flex w-full items-center justify-between gap-2 font-semibold">
                  <span className="truncate">{t.name}</span>
                  {t.budgetStatus === 'low' && <Badge variant="warning">Low</Badge>}
                  {t.budgetStatus === 'out' && <Badge>Out</Badge>}
                </span>
                <span className="tnum text-sm text-muted-foreground">{formatAmount(t.remainingBudget)} left</span>
                <span
                  className={cn(
                    'tnum text-xs',
                    cannotAfford ? 'text-destructive' : t.budgetStatus === 'low' ? 'text-warning' : 'text-muted-foreground',
                  )}
                >
                  max {formatAmount(t.maxBid)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResultLot({ tournamentId, state }: { tournamentId: Id<'tournaments'>; state: ConsoleState }) {
  const nextLot = useMutation(api.auction.nextLot);
  const undoSold = useMutation(api.auction.undoSold);

  const player = state.activePlayer;
  if (!player) return <Spinner />;
  const sold = player.status === 'sold';
  const team = state.teams.find((t) => t._id === player.soldToTeamId);

  async function next() {
    try {
      await nextLot({ tournamentId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not advance');
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
      {/* Resolved lot */}
      <Card className="flex flex-col gap-5 p-6">
        <div className="flex items-center gap-4">
          <AvatarImage src={player.imageUrl} name={player.name} className="size-20 rounded-2xl text-3xl" />
          <div>
            <p className="eyebrow">{sold ? 'Sold' : 'Unsold'}</p>
            <h2 className="display text-3xl">{player.name}</h2>
            <p className="text-sm text-muted-foreground">
              {player.role ? `${player.role} · ` : ''}min {formatAmount(player.minBid)}
            </p>
          </div>
        </div>

        <div
          className={cn(
            'rounded-2xl border p-6 text-center',
            sold ? 'border-positive/40 bg-positive/5' : 'border-destructive/40 bg-destructive/5',
          )}
        >
          {sold ? (
            <>
              <p className="eyebrow">Sold to</p>
              <p className="display my-1 text-3xl">{team?.name ?? 'Unknown team'}</p>
              <p className="tnum display text-5xl text-positive">{formatAmount(player.soldPrice)}</p>
            </>
          ) : (
            <>
              <p className="display text-3xl text-destructive">Unsold</p>
              <p className="mt-1 text-sm text-muted-foreground">No bids were placed for this player.</p>
            </>
          )}
        </div>

        {sold && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground"
            onClick={() => {
              if (confirm(`Undo the sale of ${player.name}? The player returns to the pool and the team is refunded.`)) {
                void undoSold({ tournamentId, playerId: player._id })
                  .then(() => toast.success('Sale undone'))
                  .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not undo'));
              }
            }}
          >
            <Undo2 className="size-4" /> Undo sale
          </Button>
        )}
      </Card>

      {/* Advance */}
      <div className="flex flex-col justify-center gap-3">
        <p className="eyebrow">This player stays on the live screen until you continue</p>
        <Button size="xl" onClick={() => void next()}>
          <ArrowRight className="size-5" /> Next player
        </Button>
        <p className="text-xs text-muted-foreground">
          You&apos;ll then reveal a random player or pick the next one from the list.
        </p>
      </div>
    </div>
  );
}

function SelectPlayer({ tournamentId }: { tournamentId: Id<'tournaments'> }) {
  const players = useQuery(api.players.listByTournament, { tournamentId });
  const selectPlayer = useMutation(api.auction.selectPlayer);
  const selectRandomPlayer = useMutation(api.auction.selectRandomPlayer);

  if (players === undefined) return <Spinner />;
  const available = players.filter((p) => p.status === 'available');
  const unsold = players.filter((p) => p.status === 'unsold');

  async function revealRandom() {
    try {
      await selectRandomPlayer({ tournamentId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not pick a player');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <p className="display text-2xl">No active lot</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Reveal the next player at random for some drama, or pick one manually below.
        </p>
        <Button size="xl" onClick={() => void revealRandom()} disabled={available.length === 0}>
          <Shuffle className="size-5" /> Reveal random player
        </Button>
      </Card>

      <Section
        title="Available"
        players={available}
        onSelect={(playerId) => void selectPlayer({ tournamentId, playerId })}
      />
      {unsold.length > 0 && (
        <Section
          title="Unsold · re-auction"
          players={unsold}
          onSelect={(playerId) => void selectPlayer({ tournamentId, playerId })}
        />
      )}
    </div>
  );
}

function Section({
  title,
  players,
  onSelect,
}: {
  title: string;
  players: {
    _id: Id<'players'>;
    name: string;
    role?: string;
    imageUrl: string | null;
    isCaptain: boolean;
  }[];
  onSelect: (playerId: Id<'players'>) => void;
}) {
  if (players.length === 0) return <p className="text-sm text-muted-foreground">No {title.toLowerCase()} players.</p>;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="eyebrow">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => (
          <button
            key={p._id}
            onClick={() => onSelect(p._id)}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-all hover:-translate-y-0.5 hover:border-accent/60 active:scale-[0.98]"
          >
            <AvatarImage src={p.imageUrl} name={p.name} className="size-12 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-semibold">
                {p.name}
                {p.isCaptain && <Badge variant="accent">C</Badge>}
              </p>
              <p className="tnum text-sm text-muted-foreground">
                {p.role ? p.role : p.isCaptain ? 'Captain' : 'Player'}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TeamRosters({ teams, rosterSize }: { teams: ConsoleState['teams']; rosterSize: number }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="eyebrow">Team rosters</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((t) => (
          <Card key={t._id} className="flex flex-col gap-2 p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{t.name}</span>
              <span className="tnum text-xs text-muted-foreground">
                {t.playersWon}/{rosterSize}
              </span>
            </div>
            {t.roster.length === 0 ? (
              <p className="text-xs text-muted-foreground">No players yet.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {t.roster.map((p) => (
                  <li key={p._id} className="flex justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="tnum text-muted-foreground">{formatAmount(p.soldPrice)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
