'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id, TeamWithLogo } from '@/types';
import { Button } from '@/components/ui/button';
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
import { formatAmount, teamCode } from '@/helpers/format';
import { uploadFile } from '@/helpers/upload';
import { cn } from '@/lib/utils';

export function TeamsManager({ tournamentId }: { tournamentId: Id<'tournaments'> }) {
  const teams = useQuery(api.teams.listByTournament, { tournamentId });
  const tournament = useQuery(api.tournaments.get, { tournamentId });
  const create = useMutation(api.teams.create);
  const remove = useMutation(api.teams.remove);
  const generateUploadUrl = useMutation(api.teams.generateUploadUrl);

  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<TeamWithLogo | null>(null);

  const cap = tournament?.defaultBudget ?? 0;
  const rosterSize = tournament?.rosterSize ?? 0;

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
    <div className="flex flex-col gap-5">
      {/* Add a team — inline form */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="text-[15px] font-extrabold">Add a team</div>
        <div className="mb-4 mt-1 text-[12.5px] text-muted-foreground">
          Enter each squad&apos;s name, an optional purse and logo.
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto]">
          <div>
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="Royal Strikers"
            />
          </div>
          <div>
            <Label htmlFor="team-budget">Purse (optional)</Label>
            <Input
              id="team-budget"
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder={cap ? formatAmount(cap) : 'Default'}
              className="mono"
            />
          </div>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            <Plus className="size-4" /> {busy ? 'Adding…' : 'Add'}
          </Button>
        </div>
        <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ImagePlus className="size-3.5" /> Add a logo
          <Input ref={fileRef} type="file" accept="image/*" className="h-8 w-44 py-1 text-xs" />
        </label>
      </div>

      {teams === undefined ? (
        <Spinner />
      ) : teams.length === 0 ? (
        <EmptyHint label="No teams yet — add your squads above to get started." />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const spent = Math.max(0, cap - t.remainingBudget);
            const spentPct = cap > 0 ? Math.min(100, (spent / cap) * 100) : 0;
            return (
              <div key={t._id} className="overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="flex items-center gap-3 border-b border-border p-4">
                  <AvatarImage
                    src={t.logoUrl}
                    name={t.name}
                    className="mono size-10 rounded-[11px] text-[13px] font-extrabold"
                    monogramClassName="text-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-extrabold">{t.name}</div>
                    <div className="mono text-[11.5px] text-muted-foreground">{teamCode(t.name)}</div>
                  </div>
                  <button
                    onClick={() => setEditing(t)}
                    className="p-1 text-muted-foreground transition-colors hover:text-accent"
                    aria-label={`Edit ${t.name}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${t.name}?`)) void remove({ teamId: t._id });
                    }}
                    className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`Remove ${t.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="p-4">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
                    <span>Points left</span>
                    <span>
                      {t.playersWon}
                      {rosterSize ? `/${rosterSize}` : ''} players
                    </span>
                  </div>
                  <div className="mono mb-2.5 text-[22px] font-extrabold text-accent">
                    {formatAmount(t.remainingBudget)}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-foreground"
                      style={{ width: `${spentPct}%` }}
                    />
                  </div>
                  {cap > 0 && (
                    <div className="mono mt-1.5 text-[11px] text-muted-foreground/80">
                      {formatAmount(spent)} spent of {formatAmount(cap)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EditTeamDialog team={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditTeamDialog({ team, onClose }: { team: TeamWithLogo | null; onClose: () => void }) {
  const update = useMutation(api.teams.update);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

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
    <div
      className={cn(
        'flex items-center justify-center rounded-2xl border border-dashed border-input bg-surface px-5 py-12 text-center text-sm text-muted-foreground',
      )}
    >
      {label}
    </div>
  );
}
