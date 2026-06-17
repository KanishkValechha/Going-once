'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/types';
import { Badge, Button, Spinner } from '@/components/ui';
import { TeamsManager } from '@/components/admin/TeamsManager';
import { PlayersManager } from '@/components/admin/PlayersManager';
import { CaptainsManager } from '@/components/admin/CaptainsManager';
import { TournamentSettings } from '@/components/admin/TournamentSettings';
import { TournamentMembers } from '@/components/admin/TournamentMembers';

const TABS = ['Teams', 'Players', 'Captains', 'Members', 'Settings'] as const;
type Tab = (typeof TABS)[number];

export default function TournamentHub({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params);
  const id = tournamentId as Id<'tournaments'>;
  const tournament = useQuery(api.tournaments.get, { tournamentId: id });
  const [tab, setTab] = useState<Tab>('Teams');

  if (tournament === undefined) return <Spinner />;
  if (tournament === null) return <p className="text-muted">Tournament not found.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-muted hover:text-foreground">
            ← All tournaments
          </Link>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <Badge tone={tournament.status === 'live' ? 'accent' : 'neutral'}>{tournament.status}</Badge>
        </div>
        <Link href={`/admin/${tournamentId}/auction`}>
          <Button>Open Auction Console →</Button>
        </Link>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition ${
              tab === t ? 'border-accent text-foreground' : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Teams' && <TeamsManager tournamentId={id} />}
      {tab === 'Players' && <PlayersManager tournamentId={id} />}
      {tab === 'Captains' && <CaptainsManager tournamentId={id} />}
      {tab === 'Members' && <TournamentMembers tournamentId={id} />}
      {tab === 'Settings' && <TournamentSettings tournament={tournament} />}
    </div>
  );
}
