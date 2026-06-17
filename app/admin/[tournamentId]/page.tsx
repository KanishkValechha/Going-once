'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { ArrowLeft, Crown, LayoutDashboard, Radio, Shield, Users, Users2 } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamsManager } from '@/components/admin/TeamsManager';
import { PlayersManager } from '@/components/admin/PlayersManager';
import { CaptainsManager } from '@/components/admin/CaptainsManager';
import { TournamentMembers } from '@/components/admin/TournamentMembers';
import { TournamentOverview } from '@/components/admin/TournamentOverview';

export default function TournamentHub({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params);
  const id = tournamentId as Id<'tournaments'>;
  const tournament = useQuery(api.tournaments.get, { tournamentId: id });

  if (tournament === undefined)
    return <Spinner label="Loading tournament…" />;
  if (tournament === null)
    return <p className="text-muted-foreground">Tournament not found.</p>;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> All tournaments
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="display text-4xl">{tournament.name}</h1>
            <Badge variant={tournament.status === 'live' ? 'live' : tournament.status === 'completed' ? 'positive' : 'neutral'}>
              {tournament.status === 'live' && (
                <span className="size-1.5 animate-live-pulse rounded-full bg-live" />
              )}
              {tournament.status}
            </Badge>
          </div>
          <Link href={`/admin/${tournamentId}/auction`}>
            <Button size="lg" variant={tournament.status === 'live' ? 'default' : 'secondary'}>
              <Radio className="size-4" /> Auction console
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="overview">
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
          <TabsTrigger value="members">
            <Users className="size-4" /> Members
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <TournamentOverview tournament={tournament} />
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
        <TabsContent value="members">
          <TournamentMembers tournamentId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
