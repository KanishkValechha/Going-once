'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  CheckCircle2,
  Circle,
  Copy,
  Flag,
  RadioTower,
  RefreshCw,
  Rocket,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id, Tournament } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { buildLiveUrl } from '@/helpers/live';
import { cn } from '@/lib/utils';

export function TournamentOverview({ tournament }: { tournament: Tournament }) {
  const id = tournament._id as Id<'tournaments'>;
  const update = useMutation(api.tournaments.update);
  const setLive = useMutation(api.tournaments.setLive);
  const complete = useMutation(api.tournaments.complete);
  const regenerate = useMutation(api.tournaments.regenerateViewerToken);
  const readiness = useQuery(api.tournaments.liveReadiness, { tournamentId: id });
  const liveConsole = useQuery(api.auction.consoleState, { tournamentId: id });

  const [name, setName] = useState(tournament.name);
  const [defaultBudget, setDefaultBudget] = useState(String(tournament.defaultBudget));
  const [rosterSize, setRosterSize] = useState(String(tournament.rosterSize));
  const [minBidIncrement, setMinBidIncrement] = useState(String(tournament.minBidIncrement));
  const [minBid, setMinBid] = useState(String(tournament.minBid ?? 100));
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const liveUrl = buildLiveUrl(tournament.viewerToken);
  const isLive = tournament.status === 'live';

  async function save() {
    setSaving(true);
    try {
      await update({
        tournamentId: id,
        name: name.trim(),
        defaultBudget: Number(defaultBudget),
        rosterSize: Number(rosterSize),
        minBidIncrement: Number(minBidIncrement),
        minBid: Number(minBid),
      });
      toast.success('Configuration saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    toast.success('Live link copied');
    setTimeout(() => setCopied(false), 1500);
  }

  async function goLive() {
    try {
      await setLive({ tournamentId: id });
      toast.success("You're live — open the auction console to begin.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not go live');
    }
  }

  async function markCompleted() {
    if (liveConsole && !liveConsole.rostersComplete) {
      const msg = `Only ${liveConsole.teamsFull}/${liveConsole.teamCount} teams have full rosters. End the auction anyway?`;
      if (!confirm(msg)) return;
    }
    await complete({ tournamentId: id });
    toast.success('Tournament marked completed');
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      {/* Launch checklist */}
      <Card className="lg:row-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="size-4 text-accent" /> Launch checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Step
            done={!!readiness?.enoughTeams}
            title="Add at least 2 teams"
            detail={readiness ? `${readiness.teamCount} added` : '…'}
          />
          <Step
            done={!!readiness?.enoughPlayers}
            title="Add enough players"
            detail={
              readiness
                ? `${readiness.playerCount} / ${readiness.requiredPlayers} (roster ${readiness.rosterSize} × ${readiness.teamCount} teams)`
                : '…'
            }
          />
          <Step
            done={isLive || tournament.status === 'completed'}
            title="Go live"
            detail={isLive ? 'Auction is live' : tournament.status === 'completed' ? 'Completed' : 'Ready when the steps above are done'}
            last
          />

          <Separator className="my-3" />

          {!isLive && tournament.status !== 'completed' && (
            <>
              <Button onClick={() => void goLive()} disabled={!readiness?.ready} size="lg">
                <RadioTower className="size-4" /> Go live
              </Button>
              {readiness && !readiness.ready && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Complete the steps above to enable going live.
                </p>
              )}
            </>
          )}
          {isLive && (
            <Button variant="secondary" onClick={() => void markCompleted()} size="lg">
              <Flag className="size-4" /> Mark completed
            </Button>
          )}
          {tournament.status === 'completed' && (
            <Badge variant="positive" className="self-start">
              <CheckCircle2 className="size-3.5" /> Auction completed
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="size-4 text-accent" /> Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="cfg-name">Name</Label>
            <Input id="cfg-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="cfg-budget">Budget / team</Label>
              <Input id="cfg-budget" type="number" value={defaultBudget} onChange={(e) => setDefaultBudget(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cfg-roster">Roster size</Label>
              <Input id="cfg-roster" type="number" value={rosterSize} onChange={(e) => setRosterSize(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cfg-incr">Min bid step</Label>
              <Input id="cfg-incr" type="number" value={minBidIncrement} onChange={(e) => setMinBidIncrement(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="cfg-minbid">Min bid / player</Label>
            <Input id="cfg-minbid" type="number" value={minBid} onChange={(e) => setMinBid(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            The minimum bid is the opening price for every player. Captains have their own minimum, set per captain when
            you add them. Budget and roster size apply to teams created after the change; existing teams keep their
            current budget.
          </p>
          <Button onClick={() => void save()} disabled={saving || !name.trim()} className="self-start">
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Share live link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RadioTower className="size-4 text-accent" /> View-only live link
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Display the auction on a projector or TV. Works without login while the tournament is live.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={liveUrl} className="flex-1 font-mono text-xs" />
            <Button variant="secondary" size="icon" onClick={() => void copyLink()} title="Copy link">
              <Copy className={cn('size-4', copied && 'text-positive')} />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              if (confirm('Regenerate the link? The current one will stop working.')) {
                void regenerate({ tournamentId: id }).then(() => toast.success('Link regenerated'));
              }
            }}
          >
            <RefreshCw className="size-3.5" /> Regenerate link
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({
  done,
  title,
  detail,
  last,
}: {
  done: boolean;
  title: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-3 pb-1">
      {!last && (
        <span
          className={cn(
            'absolute top-6 left-[0.6875rem] h-[calc(100%-0.5rem)] w-px',
            done ? 'bg-accent/40' : 'bg-border',
          )}
          aria-hidden
        />
      )}
      {done ? (
        <CheckCircle2 className="size-6 shrink-0 text-accent" />
      ) : (
        <Circle className="size-6 shrink-0 text-muted-foreground/50" />
      )}
      <div className="pt-0.5">
        <p className={cn('text-sm font-semibold', done ? 'text-foreground' : 'text-muted-foreground')}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
