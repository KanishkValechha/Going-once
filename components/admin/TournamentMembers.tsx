'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

export function TournamentMembers({ tournamentId }: { tournamentId: Id<'tournaments'> }) {
  const members = useQuery(api.tournaments.listMembers, { tournamentId });
  const addMember = useMutation(api.tournaments.addMember);
  const removeMember = useMutation(api.tournaments.removeMember);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await addMember({ tournamentId, email: trimmed });
      toast.success(`${trimmed} added`);
      setEmail('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add member');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4 text-accent" /> Add a member
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Anyone added here can view and edit this tournament. New emails are invited to the portal automatically and
            linked on their first login.
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label htmlFor="m-email">Email</Label>
              <Input
                id="m-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="person@example.com"
                onKeyDown={(e) => e.key === 'Enter' && void add()}
              />
            </div>
            <Button onClick={() => void add()} disabled={busy || !email.trim()}>
              <UserPlus className="size-4" /> {busy ? 'Adding…' : 'Add member'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden p-0">
        {members === undefined ? (
          <Spinner />
        ) : members.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No members yet.</p>
        ) : (
          members.map((m) => (
            <div
              key={m.membershipId}
              className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5 last:border-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{m.email}</span>
                  {m.role === 'admin' && <Badge variant="accent">Admin</Badge>}
                  {m.isCreator && <Badge>Creator</Badge>}
                  {m.pending && <Badge>Pending</Badge>}
                </div>
                {m.name && <span className="text-xs text-muted-foreground">{m.name}</span>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                disabled={m.isCreator}
                onClick={() => {
                  if (confirm(`Remove ${m.email} from this tournament?`)) {
                    void removeMember({ tournamentId, userId: m.userId });
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
