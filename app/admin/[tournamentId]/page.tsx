'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  ExternalLink,
  LayoutDashboard,
  ListOrdered,
  Pause,
  Radio,
  RadioTower,
  Shield,
  Swords,
  Users,
  Users2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id, Tournament } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamsManager } from '@/components/admin/TeamsManager';
import { PlayersManager } from '@/components/admin/PlayersManager';
import { CaptainsManager } from '@/components/admin/CaptainsManager';
import { TournamentMembers } from '@/components/admin/TournamentMembers';
import { TournamentOverview } from '@/components/admin/TournamentOverview';
import { BracketManager } from '@/components/admin/BracketManager';
import { StandingsBoard } from '@/components/admin/StandingsBoard';
import { AuctionExport } from '@/components/admin/AuctionExport';
import { NextStepBanner, RunOrderBoard, type WorkspaceTab } from '@/components/admin/RunOrder';
import { buildLiveUrl } from '@/helpers/live';
import { FORMAT_LABEL, PHASE_LABEL, PHASE_VARIANT, derivePhase, type Progress } from '@/helpers/tournament';

/**
 * The single most useful place to send the organizer next, given how far the
 * tournament has come: into the auction console while players are still in the
 * pool, then on to fixtures, live matches and finally the standings.
 */
type Destination = { label: string; href?: string; tab?: WorkspaceTab };
function nextDestination(p: Progress | undefined, tournamentId: string): Destination {
  const auctionDone = !!p && p.playerCount > 0 && p.poolCount === 0;
  if (!auctionDone) return { label: 'Go to auction', href: `/admin/${tournamentId}/auction` };
  if (p!.matchCount === 0) return { label: 'Go to fixtures', tab: 'fixtures' };
  if (p!.finalsCount < p!.playableCount) return { label: 'Go to matches', tab: 'fixtures' };
  return { label: 'Go to standings', tab: 'standings' };
}

export default function TournamentHub({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params);
  const id = tournamentId as Id<'tournaments'>;
  const tournament = useQuery(api.tournaments.get, { tournamentId: id });
  const progress = useQuery(api.tournaments.progress, { tournamentId: id });
  const setLive = useMutation(api.tournaments.setLive);
  const pause = useMutation(api.tournaments.pause);
  const [tab, setTab] = useState<WorkspaceTab>('overview');

  async function goLive() {
    try {
      await setLive({ tournamentId: id });
      toast.success("You're live — the public screen is now showing this tournament.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not go live');
    }
  }

  async function pauseLive() {
    try {
      await pause({ tournamentId: id });
      toast.success('Paused — off the live screen. Everything is saved; go live again to resume.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not pause');
    }
  }

  if (tournament === undefined) return <Spinner label="Loading tournament…" />;
  if (tournament === null) return <p className="text-muted-foreground">Tournament not found.</p>;

  const phase = progress ? derivePhase(progress) : null;
  const isLive = tournament.status === 'live';
  const ready =
    !!progress &&
    progress.teamCount >= 2 &&
    progress.playerCount >= tournament.rosterSize * progress.teamCount;
  const dest = nextDestination(progress, tournamentId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> All tournaments
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="display text-4xl">{tournament.name}</h1>
            {phase && (
              <Badge variant={PHASE_VARIANT[phase]}>
                {phase === 'live' && <span className="size-1.5 animate-live-pulse rounded-full bg-live" />}
                {PHASE_LABEL[phase]}
              </Badge>
            )}
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {FORMAT_LABEL[tournament.format ?? 'round_robin']}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isLive ? (
              <Button size="lg" variant="secondary" onClick={() => void pauseLive()}>
                <Pause className="size-4" /> Pause
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => void goLive()}
                disabled={!ready}
                title={ready ? undefined : 'Add at least 2 teams and enough players first'}
              >
                <RadioTower className="size-4" /> Go live
              </Button>
            )}
            {dest.href ? (
              <Link href={dest.href}>
                <Button size="lg" variant={isLive ? 'default' : 'secondary'}>
                  <Radio className="size-4" /> {dest.label}
                </Button>
              </Link>
            ) : (
              <Button
                size="lg"
                variant={isLive ? 'default' : 'secondary'}
                onClick={() => setTab(dest.tab!)}
              >
                {dest.label} <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {progress && <NextStepBanner progress={progress} onNavigate={setTab} />}

      <Tabs value={tab} onValueChange={(v) => setTab(v as WorkspaceTab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">
            <LayoutDashboard className="size-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="teams">
            <Shield className="size-4" /> Teams
          </TabsTrigger>
          <TabsTrigger value="players">
            <Users2 className="size-4" /> Players
          </TabsTrigger>
          <TabsTrigger value="captains">
            <Crown className="size-4" /> Captains
          </TabsTrigger>
          <TabsTrigger value="auction">
            <Radio className="size-4" /> Auction
          </TabsTrigger>
          <TabsTrigger value="fixtures">
            <Swords className="size-4" /> Fixtures
          </TabsTrigger>
          <TabsTrigger value="standings">
            <ListOrdered className="size-4" /> Standings
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="size-4" /> Members
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="flex flex-col gap-8">
            {progress ? <RunOrderBoard progress={progress} onNavigate={setTab} /> : <Spinner />}
            <div>
              <h2 className="display mb-4 text-2xl">Setup &amp; sharing</h2>
              <TournamentOverview tournament={tournament} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="teams">
          <TeamsManager tournamentId={id} />
        </TabsContent>
        <TabsContent value="players">
          <PlayersManager tournamentId={id} />
        </TabsContent>
        <TabsContent value="captains">
          <CaptainsManager tournamentId={id} />
        </TabsContent>
        <TabsContent value="auction">
          <AuctionTab tournament={tournament} tournamentId={tournamentId} />
        </TabsContent>
        <TabsContent value="fixtures">
          <BracketManager tournamentId={id} />
        </TabsContent>
        <TabsContent value="standings">
          <div className="flex flex-col gap-8">
            <StandingsBoard tournamentId={id} />
            <div>
              <h2 className="display mb-4 text-2xl">Export results</h2>
              <AuctionExport tournamentId={id} />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="members">
          <TournamentMembers tournamentId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuctionTab({ tournament, tournamentId }: { tournament: Tournament; tournamentId: string }) {
  const isLive = tournament.status === 'live';
  return (
    <Card className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="display text-2xl">Auction control room</h2>
        <Badge variant={isLive ? 'live' : 'neutral'}>
          {isLive && <span className="size-1.5 animate-live-pulse rounded-full bg-live" />}
          {tournament.status}
        </Badge>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        {isLive
          ? 'The auction is live. Open the console to reveal players, take bids from the room, and mark them sold — everything mirrors instantly to the live screen.'
          : 'Go live from the Overview tab, then run the auction from the console. The console drives the public live screen.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/${tournamentId}/auction`}>
          <Button size="lg">
            <Radio className="size-4" /> Open console
          </Button>
        </Link>
        <a href={buildLiveUrl(tournament.viewerToken)} target="_blank" rel="noreferrer">
          <Button size="lg" variant="secondary">
            <ExternalLink className="size-4" /> Live screen
          </Button>
        </a>
      </div>
    </Card>
  );
}
