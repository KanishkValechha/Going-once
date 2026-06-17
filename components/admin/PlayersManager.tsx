'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/types';
import { Badge, Button, Card, Input, Label, Spinner } from '@/components/ui';
import { formatAmount } from '@/helpers/format';
import { uploadFile } from '@/helpers/upload';

const statusTone = {
  available: 'neutral',
  sold: 'positive',
  unsold: 'danger',
} as const;

export function PlayersManager({ tournamentId }: { tournamentId: Id<'tournaments'> }) {
  const players = useQuery(api.players.listByTournament, { tournamentId });
  const create = useMutation(api.players.create);
  const remove = useMutation(api.players.remove);
  const generateUploadUrl = useMutation(api.players.generateUploadUrl);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [isCaptain, setIsCaptain] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!name.trim() || !basePrice) return;
    setBusy(true);
    try {
      let imageStorageId: Id<'_storage'> | undefined;
      const file = fileRef.current?.files?.[0];
      if (file) {
        const url = await generateUploadUrl();
        imageStorageId = (await uploadFile(url, file)) as Id<'_storage'>;
      }
      await create({
        tournamentId,
        name: name.trim(),
        role: role.trim() || undefined,
        basePrice: Number(basePrice),
        isCaptain,
        imageStorageId,
      });
      setName('');
      setRole('');
      setBasePrice('');
      setIsCaptain(false);
      if (fileRef.current) fileRef.current.value = '';
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4">
        <h3 className="font-semibold">Add player</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="A. Sharma" />
          </div>
          <div>
            <Label>Role / category</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="All-rounder" />
          </div>
          <div>
            <Label>Base price</Label>
            <Input type="number" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
          </div>
          <div>
            <Label>Image (optional)</Label>
            <Input ref={fileRef} type="file" accept="image/*" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={isCaptain} onChange={(e) => setIsCaptain(e.target.checked)} />
          Mark as captain
        </label>
        <div>
          <Button onClick={() => void submit()} disabled={busy || !name.trim() || !basePrice}>
            {busy ? 'Adding…' : 'Add player'}
          </Button>
        </div>
      </Card>

      {players === undefined ? (
        <Spinner />
      ) : players.length === 0 ? (
        <p className="text-sm text-muted">No players yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => (
            <Card key={p._id} className="flex items-center gap-3">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-2 text-muted">
                  {p.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-medium">
                  {p.name}
                  {p.isCaptain && <Badge tone="accent">C</Badge>}
                </p>
                <p className="tnum text-sm text-muted">
                  {p.role ? `${p.role} · ` : ''}base {formatAmount(p.basePrice)}
                </p>
              </div>
              <Badge tone={statusTone[p.status]}>{p.status}</Badge>
              <Button variant="danger" onClick={() => void remove({ playerId: p._id })}>
                ✕
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
