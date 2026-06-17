'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Crown, ImagePlus, Plus, Trash2, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id, PlayerStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { AvatarImage } from '@/components/ui/avatar-image';
import { formatAmount } from '@/helpers/format';
import { uploadFile } from '@/helpers/upload';
import { EmptyHint } from '@/components/admin/TeamsManager';

const statusVariant: Record<PlayerStatus, 'neutral' | 'positive' | 'destructive'> = {
  available: 'neutral',
  sold: 'positive',
  unsold: 'destructive',
};

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
      toast.success(`${name.trim()} added`);
      setName('');
      setRole('');
      setBasePrice('');
      setIsCaptain(false);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add player');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
      <Card className="h-fit lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users2 className="size-4 text-accent" /> Add player
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="A. Sharma" />
          </div>
          <div>
            <Label htmlFor="p-role">Role / category</Label>
            <Input id="p-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="All-rounder" />
          </div>
          <div>
            <Label htmlFor="p-base">Base price</Label>
            <Input
              id="p-base"
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="500"
            />
          </div>
          <div>
            <Label>
              <ImagePlus className="size-3.5" /> Photo
            </Label>
            <Input ref={fileRef} type="file" accept="image/*" />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
            <Checkbox checked={isCaptain} onCheckedChange={(c) => setIsCaptain(c === true)} />
            <span className="flex items-center gap-1.5">
              <Crown className="size-3.5 text-accent" /> Mark as captain
            </span>
          </label>
          <Button onClick={() => void submit()} disabled={busy || !name.trim() || !basePrice}>
            <Plus className="size-4" /> {busy ? 'Adding…' : 'Add player'}
          </Button>
        </CardContent>
      </Card>

      <div>
        {players === undefined ? (
          <Spinner />
        ) : players.length === 0 ? (
          <EmptyHint label="No players yet — add your first on the left." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {players.map((p) => (
              <Card key={p._id} className="group flex items-center gap-3 p-3">
                <AvatarImage src={p.imageUrl} name={p.name} className="size-12 rounded-lg text-xl" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {p.name}
                    {p.isCaptain && (
                      <Crown className="size-3.5 shrink-0 text-accent" aria-label="Captain" />
                    )}
                  </p>
                  <p className="tnum text-sm text-muted-foreground">
                    {p.role ? `${p.role} · ` : ''}base {formatAmount(p.basePrice)}
                  </p>
                </div>
                <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={() => {
                    if (confirm(`Remove ${p.name}?`)) void remove({ playerId: p._id });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
