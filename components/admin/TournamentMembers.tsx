'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/types';
import { Badge, Button, Card, Input, Label, Spinner } from '@/components/ui';

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
      setEmail('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <div>
          <h3 className="font-semibold">Add a member</h3>
          <p className="text-sm text-muted">
            Anyone added here can view and edit this tournament. New emails are invited to the portal
            automatically and linked on their first login.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
              onKeyDown={(e) => e.key === 'Enter' && void add()}
            />
          </div>
          <Button onClick={() => void add()} disabled={busy || !email.trim()}>
            {busy ? 'Adding…' : 'Add member'}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-1 p-0">
        {members === undefined ? (
          <Spinner />
        ) : members.length === 0 ? (
          <p className="p-5 text-sm text-muted">No members yet.</p>
        ) : (
          members.map((m) => (
            <div
              key={m.membershipId}
              className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{m.email}</span>
                  {m.role === 'admin' && <Badge tone="accent">Admin</Badge>}
                  {m.isCreator && <Badge tone="neutral">Creator</Badge>}
                  {m.pending && <Badge tone="neutral">Pending</Badge>}
                </div>
                {m.name && <span className="text-xs text-muted">{m.name}</span>}
              </div>
              <Button
                variant="danger"
                disabled={m.isCreator}
                onClick={() => {
                  if (confirm(`Remove ${m.email} from this tournament?`)) {
                    void removeMember({ tournamentId, userId: m.userId });
                  }
                }}
              >
                Remove
              </Button>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
