'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { TournamentFormat } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  FORMAT_DESC,
  FORMAT_LABEL,
  FORMAT_ORDER,
  PHASE_LABEL,
  PHASE_VARIANT,
  derivePhase,
} from '@/helpers/tournament';
import { cn } from '@/lib/utils';

export default function AdminHome() {
  const tournaments = useQuery(api.tournaments.dashboard);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Admin console</p>
          <h1 className="display mt-1.5 text-4xl sm:text-5xl">Your tournaments</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Create a competition, build squads, run the auction, then host the matches.
          </p>
        </div>
        <CreateTournament />
      </div>

      {tournaments === undefined ? (
        <Spinner label="Loading tournaments…" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t, i) => {
            const phase = derivePhase(t);
            return (
              <Link
                key={t._id}
                href={`/admin/${t._id}`}
                style={{ animationDelay: `${i * 45}ms` }}
                className="animate-rise"
              >
                <div className="group h-full rounded-2xl border border-border bg-surface p-5 transition-all hover:-translate-y-1 hover:border-input">
                  <div className="mb-3.5 flex items-center justify-between gap-2.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      {FORMAT_LABEL[t.format ?? 'round_robin']}
                    </span>
                    <Badge variant={PHASE_VARIANT[phase]}>
                      {phase === 'live' && (
                        <span className="size-1.5 animate-live-pulse rounded-full bg-live" />
                      )}
                      {PHASE_LABEL[phase]}
                    </Badge>
                  </div>
                  <h3 className="mb-4 text-lg font-extrabold tracking-tight">{t.name}</h3>
                  <div className="flex gap-5">
                    <CardStat label="Teams" value={String(t.teamCount)} />
                    <CardStat label="Players" value={String(t.playerCount)} />
                    <CardStat label="Pts / team" value={formatAmount(t.defaultBudget)} accent />
                  </div>
                </div>
              </Link>
            );
          })}
          <CreateTournament variant="card" />
        </div>
      )}
    </div>
  );
}

function CardStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={cn('mono text-xl font-extrabold', accent && 'text-accent')}>{value}</div>
      <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function CreateTournament({ variant }: { variant?: 'card' }) {
  const create = useMutation(api.tournaments.create);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('round_robin');
  const [budget, setBudget] = useState('10000');
  const [step, setStep] = useState('100');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const id = await create({
        name: trimmed,
        format,
        defaultBudget: Math.max(1, Number(budget) || 10000),
        minBidIncrement: Math.max(1, Number(step) || 100),
      });
      toast.success(`"${trimmed}" created — let's add teams.`);
      router.push(`/admin/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create tournament');
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      {variant === 'card' ? (
        <button
          onClick={() => setOpen(true)}
          className="flex min-h-[158px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-input text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-surface-2 text-2xl font-light">
            +
          </span>
          <span className="text-sm font-semibold">New tournament</span>
        </button>
      ) : (
        <Button size="lg" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New tournament
        </Button>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a tournament</DialogTitle>
          <DialogDescription>
            Pick a format and purse — you&apos;ll add your own teams and players next.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="t-name">Tournament name</Label>
            <Input
              id="t-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
              placeholder="Summer Champions League"
            />
          </div>

          <div>
            <Label>Format</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {FORMAT_ORDER.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-colors',
                    format === f
                      ? 'border-accent bg-accent/10'
                      : 'border-input bg-surface-2 hover:border-muted-foreground/40',
                  )}
                >
                  <div className="text-[13.5px] font-extrabold">{FORMAT_LABEL[f]}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {FORMAT_DESC[f]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-budget">Purse / team (pts)</Label>
              <Input
                id="t-budget"
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="mono"
              />
            </div>
            <div>
              <Label htmlFor="t-step">Min bid step (pts)</Label>
              <Input
                id="t-step"
                type="number"
                value={step}
                onChange={(e) => setStep(e.target.value)}
                className="mono"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create & add teams'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
