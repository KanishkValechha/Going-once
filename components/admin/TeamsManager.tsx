'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { ImagePlus, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id, TeamWithLogo } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { AvatarImage } from '@/components/ui/avatar-image';
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
  const [editing, setEditing] = useState<TeamWithLogo | null>(null);

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
      toast.success(`${name.trim()} added`);
      setName('');
      setBudget('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add team');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
      <Card className="h-fit lg:sticky lg:top-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="size-4 text-accent" /> Add team
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="Royal Strikers"
            />
          </div>
          <div>
            <Label htmlFor="team-budget">Budget</Label>
            <Input
              id="team-budget"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Tournament default"
            />
          </div>
          <div>
            <Label>
              <ImagePlus className="size-3.5" /> Logo
            </Label>
            <Input ref={fileRef} type="file" accept="image/*" />
          </div>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            <Plus className="size-4" /> {busy ? 'Adding…' : 'Add team'}
          </Button>
        </CardContent>
      </Card>

      <div>
        {teams === undefined ? (
          <Spinner />
        ) : teams.length === 0 ? (
          <EmptyHint label="No teams yet — add your first on the left." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((t) => (
              <Card key={t._id} className="group flex items-center gap-3 p-3">
                <AvatarImage src={t.logoUrl} name={t.name} className="size-12 rounded-lg text-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{t.name}</p>
                  <p className="tnum text-sm text-muted-foreground">
                    {formatAmount(t.remainingBudget)} left · {t.playersWon} won
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                  onClick={() => setEditing(t)}
                  aria-label={`Edit ${t.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={() => {
                    if (confirm(`Remove ${t.name}?`)) void remove({ teamId: t._id });
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <EditTeamDialog team={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditTeamDialog({ team, onClose }: { team: TeamWithLogo | null; onClose: () => void }) {
  const update = useMutation(api.teams.update);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  // Sync local form state whenever a different team is opened for editing.
  const [syncedId, setSyncedId] = useState<Id<'teams'> | null>(null);
  if (team && team._id !== syncedId) {
    setSyncedId(team._id);
    setName(team.name);
  }

  async function save() {
    if (!team || !name.trim()) return;
    setBusy(true);
    try {
      await update({ teamId: team._id, name: name.trim() });
      toast.success(`${name.trim()} updated`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update team');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={team !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit team</DialogTitle>
        </DialogHeader>
        <div>
          <Label htmlFor="edit-team-name">Team name</Label>
          <Input
            id="edit-team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void save()}
            placeholder="Royal Strikers"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EmptyHint({ label }: { label: string }) {
  return (
    <Card className="flex items-center justify-center border-dashed py-14 text-center text-sm text-muted-foreground">
      {label}
    </Card>
  );
}
