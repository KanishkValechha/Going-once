'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { ArrowUpRight, Gavel, Plus, Radio, Users2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { formatAmount } from '@/helpers/format';
import type { TournamentStatus } from '@/types';

const statusVariant: Record<TournamentStatus, 'neutral' | 'live' | 'positive'> = {
  draft: 'neutral',
  live: 'live',
  completed: 'positive',
};

export default function AdminHome() {
  const tournaments = useQuery(api.tournaments.list);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Auction Control</p>
          <h1 className="display mt-1 text-5xl">Tournaments</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Spin up an auction, fill it with teams and players, then take it live in the room.
          </p>
        </div>
        <CreateTournament />
      </div>

      {tournaments === undefined ? (
        <Spinner label="Loading tournaments…" />
      ) : tournaments.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t, i) => (
            <Link key={t._id} href={`/admin/${t._id}`} style={{ animationDelay: `${i * 45}ms` }} className="animate-rise">
              <Card className="group h-full p-5 transition-all hover:-translate-y-1 hover:border-accent/60">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h3 className="display text-2xl leading-none">{t.name}</h3>
                  <Badge variant={statusVariant[t.status]}>
                    {t.status === 'live' && (
                      <span className="size-1.5 animate-live-pulse rounded-full bg-live" />
                    )}
                    {t.status}
                  </Badge>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Stat icon={<Wallet className="size-3.5" />} label="Budget" value={formatAmount(t.defaultBudget)} />
                  <Stat icon={<Users2 className="size-3.5" />} label="Roster" value={String(t.rosterSize)} />
                </dl>
                <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors group-hover:text-accent">
                  Manage tournament
                  <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/50 px-3 py-2">
      <dt className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="tnum mt-0.5 text-base font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-3 border-dashed py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
        <Gavel className="size-7" />
      </div>
      <p className="display text-2xl">No tournaments yet</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Create your first auction to start adding teams and players.
      </p>
    </Card>
  );
}

function CreateTournament() {
  const create = useMutation(api.tournaments.create);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const id = await create({ name: trimmed });
      toast.success(`"${trimmed}" created — let's set it up.`);
      router.push(`/admin/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create tournament');
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <Button size="lg" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New tournament
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="size-5 text-accent" /> New tournament
          </DialogTitle>
          <DialogDescription>
            Just name it — you&apos;ll configure budget, roster and players on the next screen.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="t-name">Tournament name</Label>
          <Input
            id="t-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder="Summer League 2026"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create & set up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
