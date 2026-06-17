'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Crown } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { EmptyHint } from '@/components/admin/TeamsManager';
import { formatAmount } from '@/helpers/format';

export function CaptainsManager({ tournamentId }: { tournamentId: Id<'tournaments'> }) {
  const players = useQuery(api.players.listByTournament, { tournamentId });
  const teams = useQuery(api.teams.listByTournament, { tournamentId });

  if (players === undefined || teams === undefined) return <Spinner />;

  const captains = players.filter((p) => p.isCaptain);

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Assign captains directly to a team for a set price (use 0 for a free assignment), or leave them for the live
        auction. Players flagged as captains in the Players tab appear here.
      </p>
      {captains.length === 0 ? (
        <EmptyHint label="No captains flagged yet — mark players as captains in the Players tab." />
      ) : (
        <div className="flex flex-col gap-3">
          {captains.map((c) => (
            <CaptainRow key={c._id} captain={c} teams={teams} />
          ))}
        </div>
      )}
    </div>
  );
}

function CaptainRow({
  captain,
  teams,
}: {
  captain: { _id: Id<'players'>; name: string; status: string; soldToTeamId?: Id<'teams'>; soldPrice?: number };
  teams: { _id: Id<'teams'>; name: string }[];
}) {
  const directAssign = useMutation(api.players.directAssign);
  const [teamId, setTeamId] = useState<string>('');
  const [price, setPrice] = useState('0');
  const [busy, setBusy] = useState(false);

  const assignedTeam = captain.soldToTeamId ? teams.find((t) => t._id === captain.soldToTeamId) : null;

  async function assign() {
    if (!teamId) return;
    setBusy(true);
    try {
      await directAssign({ playerId: captain._id, teamId: teamId as Id<'teams'>, price: Number(price) });
      toast.success(`${captain.name} assigned`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not assign');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Crown className="size-4 shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{captain.name}</p>
          {captain.status === 'sold' && assignedTeam ? (
            <p className="text-sm text-positive">
              Captain of {assignedTeam.name} · {formatAmount(captain.soldPrice ?? 0)}
            </p>
          ) : (
            <Badge>unassigned</Badge>
          )}
        </div>
      </div>
      {captain.status !== 'sold' && (
        <div className="flex items-center gap-2">
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select team…" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-28"
            placeholder="Price"
          />
          <Button onClick={() => void assign()} disabled={busy || !teamId}>
            Assign
          </Button>
        </div>
      )}
    </Card>
  );
}
