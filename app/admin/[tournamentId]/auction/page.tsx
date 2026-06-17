'use client';

import { use } from 'react';
import Link from 'next/link';
import { useAtom } from 'jotai';
import { useMutation, useQuery } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/types';
import { Badge, Button, Card, Input, Spinner } from '@/components/ui';
import { formatAmount } from '@/helpers/format';
import { buildLiveUrl } from '@/helpers/live';
import { nextBid } from '@/convex/lib/increment';
import { overrideBidAtom, pendingActionAtom } from '@/jotai/auction';

export default function AuctionConsolePage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params);
  const id = tournamentId as Id<'tournaments'>;
  const state = useQuery(api.auction.consoleState, { tournamentId: id });

  if (state === undefined) return <Spinner />;
  if (state === null) return <p className="text-muted">Tournament not found.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/admin/${tournamentId}`} className="text-sm text-muted hover:text-foreground">
            ← {state.tournament.name}
          </Link>
          <h1 className="text-xl font-bold">Auction Console</h1>
          <Badge tone={state.tournament.status === 'live' ? 'accent' : 'neutral'}>{state.tournament.status}</Badge>
        </div>
        <a href={buildLiveUrl(state.tournament.viewerToken)} target="_blank" rel="noreferrer">
          <Button variant="secondary">Open live screen ↗</Button>
        </a>
      </div>

      {state.tournament.status !== 'live' && (
        <Card className="border-accent/40 text-sm text-muted">
          This tournament isn&apos;t live yet — the public screen won&apos;t show it. Go live from the tournament
          Settings tab.
        </Card>
      )}

      <RosterProgress state={state} />

      {state.phase === 'bidding' ? (
        <ActiveLot tournamentId={id} state={state} />
      ) : (
        <SelectPlayer tournamentId={id} />
      )}

      <TeamRosters teams={state.teams} rosterSize={state.tournament.rosterSize} />
    </div>
  );
}

function TeamRosters({
  teams,
  rosterSize,
}: {
  teams: ConsoleState['teams'];
  rosterSize: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Team rosters</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((t) => (
          <Card key={t._id} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{t.name}</span>
              <span className="tnum text-xs text-muted">
                {t.playersWon}/{rosterSize}
              </span>
            </div>
            {t.roster.length === 0 ? (
              <p className="text-xs text-muted">No players yet.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {t.roster.map((p) => (
                  <li key={p._id} className="flex justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="tnum text-muted">{formatAmount(p.soldPrice)}</span>
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

type ConsoleState = NonNullable<FunctionReturnType<typeof api.auction.consoleState>>;

function RosterProgress({ state }: { state: ConsoleState }) {
  const { teamsFull, teamCount, rostersComplete, availablePlayers } = state;
  return (
    <Card
      className={`flex flex-wrap items-center justify-between gap-2 text-sm ${
        rostersComplete ? 'border-positive/40' : 'border-border'
      }`}
    >
      <span className="flex items-center gap-2">
        <Badge tone={rostersComplete ? 'positive' : 'neutral'}>
          {teamsFull}/{teamCount} rosters full
        </Badge>
        {rostersComplete ? (
          <span className="text-positive">All teams have enough players — you can mark the tournament completed.</span>
        ) : (
          <span className="text-muted">Keep the auction going until every team fills its roster.</span>
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

  const prospectiveBid = nextBid(state.currentBid ?? undefined, player.basePrice, state.tournament.minBidIncrement);

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
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      {/* Active lot */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {player.imageUrl ? (
            <img src={player.imageUrl} alt="" className="h-20 w-20 rounded-xl object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-2 text-2xl text-muted">
              {player.name.charAt(0)}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{player.name}</h2>
            <p className="text-sm text-muted">
              {player.role ? `${player.role} · ` : ''}base {formatAmount(player.basePrice)}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-surface-2 p-5 text-center">
          <p className="text-xs uppercase tracking-wide text-muted">Current bid</p>
          <p className="tnum my-1 text-5xl font-bold text-accent">{formatAmount(state.currentBid)}</p>
          <p className="text-sm text-muted">
            {leadingTeam ? `Leading: ${leadingTeam.name}` : 'No bids yet'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">Next auto bid: {formatAmount(prospectiveBid)}</p>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Manual override amount"
              value={override}
              onChange={(e) => setOverride(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-muted">
            Enter an amount above, then tap a team to register that exact bid instead of the auto step.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={() => void undoBid({ tournamentId })} disabled={state.bidCount === 0}>
            Undo
          </Button>
          <Button
            variant="danger"
            onClick={() => setPending(pending === 'unsold' ? null : 'unsold')}
          >
            Unsold
          </Button>
          <Button
            onClick={() => setPending(pending === 'sold' ? null : 'sold')}
            disabled={!state.leadingTeamId}
          >
            Sold
          </Button>
        </div>

        {pending && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <span>
              {pending === 'sold'
                ? `Sell to ${leadingTeam?.name} for ${formatAmount(state.currentBid)}?`
                : 'Mark this player unsold?'}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const action = pending === 'sold' ? markSold({ tournamentId }) : markUnsold({ tournamentId });
                  void action.then(() => setPending(null));
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
        <p className="text-sm text-muted">Tap a team when they raise their hand to register a bid.</p>
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
                className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
                  isLeading
                    ? 'border-accent bg-accent/10'
                    : cannotAfford
                      ? 'cursor-not-allowed border-danger/40 bg-danger/5 opacity-60'
                      : 'border-border bg-surface hover:border-accent/60'
                }`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  {t.name}
                  {t.budgetStatus === 'low' && <Badge tone="warning">Low</Badge>}
                  {t.budgetStatus === 'out' && <Badge tone="neutral">Out</Badge>}
                </span>
                <span className="tnum text-sm text-muted">{formatAmount(t.remainingBudget)} left</span>
                <span
                  className={`tnum mt-1 text-xs ${
                    cannotAfford ? 'text-danger' : t.budgetStatus === 'low' ? 'text-warning' : 'text-muted'
                  }`}
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
      alert(e instanceof Error ? e.message : 'Could not pick a player');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col items-center gap-3 text-center">
        <p className="text-muted">No active lot. Reveal the next player at random, or pick one manually below.</p>
        <Button onClick={() => void revealRandom()} disabled={available.length === 0}>
          🎲 Reveal random player
        </Button>
      </Card>

      <Section
        title="Available"
        players={available}
        onSelect={(playerId) => void selectPlayer({ tournamentId, playerId })}
      />
      {unsold.length > 0 && (
        <Section
          title="Unsold (re-auction)"
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
  players: { _id: Id<'players'>; name: string; role?: string; basePrice: number; imageUrl: string | null; isCaptain: boolean }[];
  onSelect: (playerId: Id<'players'>) => void;
}) {
  if (players.length === 0) return <p className="text-sm text-muted">No {title.toLowerCase()} players.</p>;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((p) => (
          <button
            key={p._id}
            onClick={() => onSelect(p._id)}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition hover:border-accent/60"
          >
            {p.imageUrl ? (
              <img src={p.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-2 text-muted">
                {p.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate font-medium">
                {p.name}
                {p.isCaptain && <Badge tone="accent">C</Badge>}
              </p>
              <p className="tnum text-sm text-muted">
                {p.role ? `${p.role} · ` : ''}base {formatAmount(p.basePrice)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
