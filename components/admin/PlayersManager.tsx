'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Crown, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id, PlayerStatus, PlayerWithImage } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { AvatarImage } from '@/components/ui/avatar-image';
import { formatAmount, teamCode } from '@/helpers/format';
import { uploadFile } from '@/helpers/upload';
import { EmptyHint } from '@/components/admin/TeamsManager';
import { cn } from '@/lib/utils';

const FILTERS: { key: PlayerStatus; label: string }[] = [
  { key: 'available', label: 'In Pool' },
  { key: 'sold', label: 'Sold' },
  { key: 'unsold', label: 'Unsold' },
];

export function PlayersManager({ tournamentId }: { tournamentId: Id<'tournaments'> }) {
  const players = useQuery(api.players.listByTournament, { tournamentId });
  const teams = useQuery(api.teams.listByTournament, { tournamentId });
  const tournament = useQuery(api.tournaments.get, { tournamentId });
  const create = useMutation(api.players.create);
  const remove = useMutation(api.players.remove);
  const generateUploadUrl = useMutation(api.players.generateUploadUrl);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [isCaptain, setIsCaptain] = useState(false);
  const [captainMinBid, setCaptainMinBid] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState<PlayerStatus>('available');
  const [editing, setEditing] = useState<PlayerWithImage | null>(null);

  const minBid = tournament?.minBid ?? 0;
  const teamName = new Map((teams ?? []).map((t) => [t._id, t.name] as const));
  const counts = {
    available: players?.filter((p) => p.status === 'available').length ?? 0,
    sold: players?.filter((p) => p.status === 'sold').length ?? 0,
    unsold: players?.filter((p) => p.status === 'unsold').length ?? 0,
  };
  const visible = players?.filter((p) => p.status === filter) ?? [];

  async function submit() {
    if (!name.trim()) return;
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
        isCaptain,
        captainMinBid: isCaptain && captainMinBid ? Number(captainMinBid) : undefined,
        imageStorageId,
      });
      toast.success(`${name.trim()} added`);
      setName('');
      setRole('');
      setIsCaptain(false);
      setCaptainMinBid('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add player');
    } finally {
      setBusy(false);
    }
  }

  function priceLine(p: PlayerWithImage): { text: string; tone: 'sold' | 'unsold' | 'pool' } {
    if (p.status === 'sold') {
      const tn = p.soldToTeamId ? teamName.get(p.soldToTeamId) : undefined;
      return { text: `${formatAmount(p.soldPrice)} pts${tn ? ` · ${teamCode(tn)}` : ''}`, tone: 'sold' };
    }
    if (p.status === 'unsold') return { text: 'Unsold', tone: 'unsold' };
    const min = p.isCaptain ? (p.captainMinBid ?? minBid) : minBid;
    return { text: `Min ${formatAmount(min)} pts`, tone: 'pool' };
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Register a player — inline form */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-4 text-[15px] font-extrabold">Register a player</div>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="A. Sharma"
            />
          </div>
          <div>
            <Label htmlFor="p-role">Role (optional)</Label>
            <Input
              id="p-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="All-Rounder"
            />
          </div>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            <Plus className="size-4" /> {busy ? 'Adding…' : 'Add'}
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <ImagePlus className="size-3.5" /> Photo
            <Input ref={fileRef} type="file" accept="image/*" className="h-8 w-40 py-1 text-xs" />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={isCaptain} onCheckedChange={(c) => setIsCaptain(c === true)} />
            <span className="flex items-center gap-1.5">
              <Crown className="size-3.5 text-accent" /> Captain
            </span>
          </label>
          {isCaptain && (
            <Input
              type="number"
              value={captainMinBid}
              onChange={(e) => setCaptainMinBid(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="Captain min bid"
              className="mono h-8 w-44 py-1 text-xs"
            />
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-[9px] px-3.5 py-2 text-[12.5px] font-bold transition-colors',
              filter === f.key
                ? 'bg-foreground text-background'
                : 'border border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {players === undefined ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyHint label="No players here yet." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => {
            const pl = priceLine(p);
            return (
              <div
                key={p._id}
                className={cn(
                  'group flex items-center gap-3 rounded-2xl border bg-surface p-3.5',
                  p.status === 'sold' ? 'border-accent/40' : 'border-border',
                )}
              >
                <AvatarImage
                  src={p.imageUrl}
                  name={p.name}
                  className="mono size-11 rounded-xl text-sm font-extrabold"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-bold">{p.name}</span>
                    {p.isCaptain && <Crown className="size-3.5 shrink-0 text-accent" aria-label="Captain" />}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {p.role ?? (p.isCaptain ? 'Captain' : 'Player')}
                  </div>
                  <div
                    className={cn(
                      'mono mt-1 text-[12px] font-bold',
                      pl.tone === 'sold'
                        ? 'text-accent'
                        : pl.tone === 'unsold'
                          ? 'text-muted-foreground/70'
                          : 'text-muted-foreground',
                    )}
                  >
                    {pl.text}
                  </div>
                </div>
                <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => setEditing(p)}
                    className="p-1 text-muted-foreground transition-colors hover:text-accent"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${p.name}?`)) void remove({ playerId: p._id });
                    }}
                    className="p-1 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`Remove ${p.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EditPlayerDialog player={editing} teams={teams ?? []} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditPlayerDialog({
  player,
  teams,
  onClose,
}: {
  player: PlayerWithImage | null;
  teams: { _id: Id<'teams'>; name: string }[];
  onClose: () => void;
}) {
  const update = useMutation(api.players.update);
  const directAssign = useMutation(api.players.directAssign);
  const unassign = useMutation(api.players.unassign);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [isCaptain, setIsCaptain] = useState(false);
  const [captainMinBid, setCaptainMinBid] = useState('');
  const [teamId, setTeamId] = useState('');
  const [price, setPrice] = useState('0');
  const [busy, setBusy] = useState(false);

  const [syncedId, setSyncedId] = useState<Id<'players'> | null>(null);
  if (player && player._id !== syncedId) {
    setSyncedId(player._id);
    setName(player.name);
    setRole(player.role ?? '');
    setIsCaptain(player.isCaptain);
    setCaptainMinBid(player.captainMinBid != null ? String(player.captainMinBid) : '');
    setTeamId(player.soldToTeamId ?? '');
    setPrice(player.soldPrice != null ? String(player.soldPrice) : '0');
  }

  const isAssigned = player?.status === 'sold';
  const assignedTeam = player?.soldToTeamId ? teams.find((t) => t._id === player.soldToTeamId) : null;

  async function save() {
    if (!player || !name.trim()) return;
    setBusy(true);
    try {
      await update({
        playerId: player._id,
        name: name.trim(),
        role: role.trim() || undefined,
        isCaptain,
        captainMinBid: isCaptain && captainMinBid ? Number(captainMinBid) : undefined,
      });
      toast.success(`${name.trim()} updated`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update player');
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    if (!player || !teamId) return;
    setBusy(true);
    try {
      await directAssign({ playerId: player._id, teamId: teamId as Id<'teams'>, price: Number(price) });
      toast.success(`${player.name} assigned`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not assign');
    } finally {
      setBusy(false);
    }
  }

  async function clearAssignment() {
    if (!player) return;
    setBusy(true);
    try {
      await unassign({ playerId: player._id });
      setTeamId('');
      setPrice('0');
      toast.success(`${player.name} unassigned`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not unassign');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={player !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit player</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="edit-p-name">Name</Label>
            <Input id="edit-p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="A. Sharma" />
          </div>
          <div>
            <Label htmlFor="edit-p-role">Role / category (optional)</Label>
            <Input id="edit-p-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="All-rounder" />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
            <Checkbox checked={isCaptain} onCheckedChange={(c) => setIsCaptain(c === true)} />
            <span className="flex items-center gap-1.5">
              <Crown className="size-3.5 text-accent" /> Mark as captain
            </span>
          </label>
          {isCaptain && (
            <div>
              <Label htmlFor="edit-p-capmin">Captain minimum bid (optional)</Label>
              <Input
                id="edit-p-capmin"
                type="number"
                value={captainMinBid}
                onChange={(e) => setCaptainMinBid(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void save()}
                placeholder="Defaults to the player minimum"
                className="mono"
              />
            </div>
          )}

          <Separator />

          <div className="flex flex-col gap-2">
            <Label>Assign to team</Label>
            {isAssigned && (
              <p className="text-sm text-positive">
                Currently on {assignedTeam?.name ?? 'a team'} · {formatAmount(player?.soldPrice ?? 0)}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger className="flex-1">
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
                onKeyDown={(e) => e.key === 'Enter' && void assign()}
                className="mono w-28"
                placeholder="Amount"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => void assign()} disabled={busy || !teamId}>
                {isAssigned ? 'Update assignment' : 'Assign to team'}
              </Button>
              {isAssigned && (
                <Button variant="ghost" onClick={() => void clearAssignment()} disabled={busy}>
                  Unassign
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Sets the player as sold to this team for a custom amount, deducting it from their budget. Use 0 for a free pick.
            </p>
          </div>
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
