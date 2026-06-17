'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id, Tournament } from '@/types';
import { Badge, Button, Card, Input, Label } from '@/components/ui';
import { buildLiveUrl } from '@/helpers/live';

export function TournamentSettings({ tournament }: { tournament: Tournament }) {
  const update = useMutation(api.tournaments.update);
  const setLive = useMutation(api.tournaments.setLive);
  const complete = useMutation(api.tournaments.complete);
  const regenerate = useMutation(api.tournaments.regenerateViewerToken);
  const readiness = useQuery(api.tournaments.liveReadiness, { tournamentId: tournament._id as Id<'tournaments'> });

  const [name, setName] = useState(tournament.name);
  const [defaultBudget, setDefaultBudget] = useState(String(tournament.defaultBudget));
  const [rosterSize, setRosterSize] = useState(String(tournament.rosterSize));
  const [minBidIncrement, setMinBidIncrement] = useState(String(tournament.minBidIncrement));
  const [copied, setCopied] = useState(false);

  const liveUrl = buildLiveUrl(tournament.viewerToken);
  const id = tournament._id as Id<'tournaments'>;

  async function save() {
    await update({
      tournamentId: id,
      name: name.trim(),
      defaultBudget: Number(defaultBudget),
      rosterSize: Number(rosterSize),
      minBidIncrement: Number(minBidIncrement),
    });
  }

  async function copyLink() {
    await navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function goLive() {
    try {
      await setLive({ tournamentId: id });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not go live');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <h3 className="font-semibold">Configuration</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Budget / team</Label>
            <Input type="number" value={defaultBudget} onChange={(e) => setDefaultBudget(e.target.value)} />
          </div>
          <div>
            <Label>Roster size</Label>
            <Input type="number" value={rosterSize} onChange={(e) => setRosterSize(e.target.value)} />
          </div>
          <div>
            <Label>Min bid increment</Label>
            <Input type="number" value={minBidIncrement} onChange={(e) => setMinBidIncrement(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted">
          Budget and roster size apply to teams created after the change; existing teams keep their current budget.
        </p>
        <div>
          <Button onClick={() => void save()}>Save changes</Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Live status</h3>
          <Badge tone={tournament.status === 'live' ? 'accent' : 'neutral'}>{tournament.status}</Badge>
        </div>
        {tournament.status !== 'live' && readiness && !readiness.ready && (
          <div className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-muted">
            {!readiness.enoughTeams && <p>Add at least 2 teams to go live.</p>}
            {!readiness.enoughPlayers && (
              <p>
                Need {readiness.requiredPlayers} players (roster {readiness.rosterSize} × {readiness.teamCount} teams) —
                you have {readiness.playerCount}.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {tournament.status !== 'live' && (
            <Button onClick={() => void goLive()} disabled={!!readiness && !readiness.ready}>
              Go live
            </Button>
          )}
          {tournament.status === 'live' && (
            <Button variant="secondary" onClick={() => void complete({ tournamentId: id })}>
              Mark completed
            </Button>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h3 className="font-semibold">View-only live link</h3>
        <p className="text-sm text-muted">
          Share this link to display the auction on a projector or TV. It works without login while the tournament is
          live.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input readOnly value={liveUrl} className="flex-1 font-mono text-xs" />
          <Button variant="secondary" onClick={() => void copyLink()}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="ghost" onClick={() => void regenerate({ tournamentId: id })}>
            Regenerate
          </Button>
        </div>
      </Card>
    </div>
  );
}
