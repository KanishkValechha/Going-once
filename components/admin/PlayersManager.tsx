'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Crown, ImagePlus, Pencil, Plus, Search, Trash2, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id, PlayerStatus, PlayerWithImage } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const teams = useQuery(api.teams.listByTournament, { tournamentId });
  const create = useMutation(api.players.create);
  const remove = useMutation(api.players.remove);
  const generateUploadUrl = useMutation(api.players.generateUploadUrl);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [isCaptain, setIsCaptain] = useState(false);
  const [captainMinBid, setCaptainMinBid] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PlayerWithImage | null>(null);

  const filtered = useMemo(() => {
    if (!players) return players;
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.role?.toLowerCase().includes(q) ?? false),
    );
  }, [players, search]);

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
            <Label htmlFor="p-role">Role / category (optional)</Label>
            <Input
              id="p-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="All-rounder"
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
          {isCaptain && (
            <div>
              <Label htmlFor="p-capmin">Captain minimum bid (optional)</Label>
              <Input
                id="p-capmin"
                type="number"
                value={captainMinBid}
                onChange={(e) => setCaptainMinBid(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void submit()}
                placeholder="Defaults to the player minimum"
              />
            </div>
          )}
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            <Plus className="size-4" /> {busy ? 'Adding…' : 'Add player'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {players !== undefined && players.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players by name or role…"
              className="pl-9"
            />
          </div>
        )}
        {players === undefined ? (
          <Spinner />
        ) : players.length === 0 ? (
          <EmptyHint label="No players yet — add your first on the left." />
        ) : filtered && filtered.length === 0 ? (
          <EmptyHint label={`No players match “${search.trim()}”.`} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtered?.map((p) => (
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
                    {p.role ? `${p.role}` : p.isCaptain ? 'Captain' : 'Player'}
                    {p.isCaptain && p.captainMinBid ? ` · min ${formatAmount(p.captainMinBid)}` : ''}
                  </p>
                </div>
                <Badge variant={statusVariant[p.status]}>{p.status}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                  onClick={() => setEditing(p)}
                  aria-label={`Edit ${p.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
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

      <EditPlayerDialog
        player={editing}
        teams={teams ?? []}
        onClose={() => setEditing(null)}
      />
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

  // Sync local form state whenever a different player is opened for editing.
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
        // Clear the captain minimum when the player is no longer a captain.
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
            <Input
              id="edit-p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="A. Sharma"
            />
          </div>
          <div>
            <Label htmlFor="edit-p-role">Role / category (optional)</Label>
            <Input
              id="edit-p-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="All-rounder"
            />
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
                className="w-28"
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
