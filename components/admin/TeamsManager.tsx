'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/types';
import { Button, Card, Input, Label, Spinner } from '@/components/ui';
import { formatAmount } from '@/helpers/format';
import { uploadFile } from '@/helpers/upload';

export function TeamsManager({ tournamentId }: { tournamentId: Id<'tournaments'> }) {
  const teams = useQuery(api.teams.listByTournament, { tournamentId });
  const create = useMutation(api.teams.create);
  const remove = useMutation(api.teams.remove);
  const generateUploadUrl = useMutation(api.teams.generateUploadUrl);

  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      let logoStorageId: Id<'_storage'> | undefined;
      const file = fileRef.current?.files?.[0];
      if (file) {
        const url = await generateUploadUrl();
        logoStorageId = (await uploadFile(url, file)) as Id<'_storage'>;
      }
      await create({
        tournamentId,
        name: name.trim(),
        budget: budget ? Number(budget) : undefined,
        logoStorageId,
      });
      setName('');
      setBudget('');
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <h3 className="font-semibold">Add team</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Team name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Royal Strikers" />
          </div>
          <div>
            <Label>Budget (optional)</Label>
            <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="default" />
          </div>
          <div>
            <Label>Logo (optional)</Label>
            <Input ref={fileRef} type="file" accept="image/*" />
          </div>
        </div>
        <div>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            {busy ? 'Adding…' : 'Add team'}
          </Button>
        </div>
      </Card>

      {teams === undefined ? (
        <Spinner />
      ) : teams.length === 0 ? (
        <p className="text-sm text-muted">No teams yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <Card key={t._id} className="flex items-center gap-3">
              {t.logoUrl ? (
                <img src={t.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-2 text-muted">
                  {t.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.name}</p>
                <p className="tnum text-sm text-muted">
                  {formatAmount(t.remainingBudget)} left · {t.playersWon} won
                </p>
              </div>
              <Button variant="danger" onClick={() => void remove({ teamId: t._id })}>
                ✕
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
