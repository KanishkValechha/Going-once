'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Badge, Button, Card, Input, Label, Spinner } from '@/components/ui';
import { formatAmount } from '@/helpers/format';
import type { TournamentStatus } from '@/types';

const statusTone: Record<TournamentStatus, 'neutral' | 'accent' | 'positive'> = {
  draft: 'neutral',
  live: 'accent',
  completed: 'positive',
};

export default function AdminHome() {
  const tournaments = useQuery(api.tournaments.list);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tournaments</h1>
          <p className="text-sm text-muted">Create an auction event, then manage its teams and players.</p>
        </div>
      </div>

      <CreateTournament />

      {tournaments === undefined ? (
        <Spinner />
      ) : tournaments.length === 0 ? (
        <p className="text-sm text-muted">No tournaments yet. Create your first one above.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <Link key={t._id} href={`/admin/${t._id}`}>
              <Card className="h-full transition hover:border-accent/60">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold">{t.name}</h3>
                  <Badge tone={statusTone[t.status]}>{t.status}</Badge>
                </div>
                <dl className="space-y-1 text-sm text-muted">
                  <div className="flex justify-between">
                    <dt>Budget / team</dt>
                    <dd className="tnum text-foreground">{formatAmount(t.defaultBudget)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Roster size</dt>
                    <dd className="tnum text-foreground">{t.rosterSize}</dd>
                  </div>
                </dl>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateTournament() {
  const create = useMutation(api.tournaments.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [defaultBudget, setDefaultBudget] = useState('10000');
  const [rosterSize, setRosterSize] = useState('11');
  const [minBidIncrement, setMinBidIncrement] = useState('100');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <div>
        <Button onClick={() => setOpen(true)}>+ New tournament</Button>
      </div>
    );
  }

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await create({
        name: name.trim(),
        defaultBudget: Number(defaultBudget),
        rosterSize: Number(rosterSize),
        minBidIncrement: Number(minBidIncrement),
      });
      setName('');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-semibold">New tournament</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer League 2026" />
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
      <div className="flex gap-2">
        <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Create'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
