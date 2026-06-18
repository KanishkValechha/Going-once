'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import {
  Check,
  Crown,
  Download,
  Network,
  RefreshCw,
  Shuffle,
  Trash2,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { downloadNodeAsPng } from '@/helpers/exportImage';
import { cn } from '@/lib/utils';

type BracketFormat =
  | 'single_elimination'
  | 'round_robin'
  | 'double_round_robin'
  | 'groups_knockout';

type BracketMatch = {
  _id: Id<'matches'>;
  stage: 'group' | 'knockout';
  groupIndex?: number;
  round: number;
  slot: number;
  label?: string;
  teamAId?: Id<'teams'>;
  teamBId?: Id<'teams'>;
  teamASource?: string;
  teamBSource?: string;
  scoreA?: number;
  scoreB?: number;
  winnerTeamId?: Id<'teams'>;
  status: 'pending' | 'ready' | 'done';
  isBye?: boolean;
  teamAName: string | null;
  teamBName: string | null;
  winnerName: string | null;
};

type StandingRow = {
  teamId: Id<'teams'>;
  name: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

const FORMAT_LABEL: Record<BracketFormat, string> = {
  single_elimination: 'Single elimination',
  round_robin: 'Round robin (league)',
  double_round_robin: 'Double round robin',
  groups_knockout: 'Groups + knockout',
};

export function BracketManager({ tournamentId }: { tournamentId: Id<'tournaments'> }) {
  const data = useQuery(api.bracket.view, { tournamentId });

  if (data === undefined) return <Spinner label="Loading bracket…" />;
  if (data === null) return <BracketGenerator tournamentId={tournamentId} />;
  return <BracketBoard tournamentId={tournamentId} data={data} />;
}

// ---------------------------------------------------------------------------
// Generator — shown when no bracket exists yet.
// ---------------------------------------------------------------------------

function BracketGenerator({ tournamentId }: { tournamentId: Id<'tournaments'> }) {
  const generate = useMutation(api.bracket.generate);
  const [format, setFormat] = useState<BracketFormat>('single_elimination');
  const [groupCount, setGroupCount] = useState('2');
  const [advancePerGroup, setAdvancePerGroup] = useState('2');
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await generate({
        tournamentId,
        format,
        ...(format === 'groups_knockout'
          ? { groupCount: Number(groupCount), advancePerGroup: Number(advancePerGroup) }
          : {}),
      });
      toast.success('Matches drawn');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate matches');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Network className="size-4 text-accent" /> Generate the tournament
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Pick a format and we&apos;ll randomly draw the matches between your teams. You can record
          scores and download the bracket once it&apos;s generated.
        </p>
        <div>
          <Label>Tournament style</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as BracketFormat)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single_elimination">Single elimination (knockout)</SelectItem>
              <SelectItem value="round_robin">Round robin (everyone plays everyone)</SelectItem>
              <SelectItem value="double_round_robin">
                Double round robin (everyone plays twice)
              </SelectItem>
              <SelectItem value="groups_knockout">Groups + knockout</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs text-muted-foreground">{FORMAT_HINT[format]}</p>
        </div>

        {format === 'groups_knockout' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="grp-count">Number of groups</Label>
              <Input
                id="grp-count"
                type="number"
                min={2}
                value={groupCount}
                onChange={(e) => setGroupCount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="grp-adv">Advance per group</Label>
              <Input
                id="grp-adv"
                type="number"
                min={1}
                value={advancePerGroup}
                onChange={(e) => setAdvancePerGroup(e.target.value)}
              />
            </div>
          </div>
        )}

        <Button onClick={() => void run()} disabled={busy} size="lg" className="self-start">
          <Shuffle className="size-4" /> {busy ? 'Drawing…' : 'Draw matches'}
        </Button>
      </CardContent>
    </Card>
  );
}

const FORMAT_HINT: Record<BracketFormat, string> = {
  single_elimination: 'A knockout bracket — lose once and you’re out. Byes are added automatically when the team count isn’t a power of two.',
  round_robin: 'Every team plays every other team once. The champion is the top of the table.',
  double_round_robin: 'Every team plays every other team twice (home and away). The champion is the top of the table.',
  groups_knockout: 'Teams are split into random groups that play a mini league; the top finishers advance to a knockout bracket.',
};

// ---------------------------------------------------------------------------
// Board — shown once a bracket exists.
// ---------------------------------------------------------------------------

type ViewData = {
  bracket: {
    _id: Id<'brackets'>;
    format: BracketFormat;
    groupCount: number | null;
    advancePerGroup: number | null;
    knockoutSeeded: boolean;
  };
  matches: BracketMatch[];
  standings: { groupIndex: number; label: string; rows: StandingRow[] }[];
  teamCount: number;
};

function BracketBoard({
  tournamentId,
  data,
}: {
  tournamentId: Id<'tournaments'>;
  data: ViewData;
}) {
  const generate = useMutation(api.bracket.generate);
  const reset = useMutation(api.bracket.reset);
  const captureRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const { format } = data.bracket;
  const knockout = data.matches.filter((m) => m.stage === 'knockout');
  const champion = findChampion(data);

  async function regenerate() {
    if (!confirm('Re-draw all matches? Current results will be lost.')) return;
    try {
      await generate({
        tournamentId,
        format,
        ...(format === 'groups_knockout'
          ? {
              groupCount: data.bracket.groupCount ?? 2,
              advancePerGroup: data.bracket.advancePerGroup ?? 2,
            }
          : {}),
      });
      toast.success('New draw generated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not regenerate');
    }
  }

  async function clear() {
    if (!confirm('Delete this bracket? You can generate a new one afterwards.')) return;
    await reset({ tournamentId });
    toast.success('Bracket cleared');
  }

  async function downloadImage() {
    if (!captureRef.current) return;
    setDownloading(true);
    try {
      await downloadNodeAsPng(captureRef.current, `bracket-${format}`);
      toast.success('Bracket image downloaded');
    } catch {
      toast.error('Could not export the image');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="accent">{FORMAT_LABEL[format]}</Badge>
          {champion && (
            <Badge variant="positive">
              <Trophy className="size-3.5" /> Champion: {champion}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => void downloadImage()} disabled={downloading}>
            <Download className="size-4" /> {downloading ? 'Exporting…' : 'Download image'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void regenerate()}>
            <RefreshCw className="size-4" /> Re-draw
          </Button>
          <Button variant="destructive" size="sm" onClick={() => void clear()}>
            <Trash2 className="size-4" /> Clear
          </Button>
        </div>
      </div>

      <div ref={captureRef} className="rounded-xl bg-surface p-5">
        {(format === 'round_robin' || format === 'double_round_robin') && (
          <RoundRobinView data={data} />
        )}
        {format === 'single_elimination' && <KnockoutView matches={knockout} />}
        {format === 'groups_knockout' && (
          <div className="flex flex-col gap-8">
            <GroupStageView data={data} />
            <div>
              <h3 className="eyebrow mb-3">
                Knockout stage{' '}
                {!data.bracket.knockoutSeeded && (
                  <span className="text-muted-foreground/70">
                    · seeds in once every group game is played
                  </span>
                )}
              </h3>
              <KnockoutView matches={knockout} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Champion = winner of the single match that has no `nextMatchId` (the final). */
function findChampion(data: ViewData): string | null {
  if (data.bracket.format === 'round_robin' || data.bracket.format === 'double_round_robin') {
    const table = data.standings[0]?.rows;
    if (table && table.length > 0 && table[0].played > 0) return table[0].name;
    return null;
  }
  // For knockout formats the final is the highest round with a single match.
  const knockout = data.matches.filter((m) => m.stage === 'knockout');
  if (knockout.length === 0) return null;
  const maxRound = Math.max(...knockout.map((m) => m.round));
  const final = knockout.find((m) => m.round === maxRound);
  return final?.status === 'done' ? final.winnerName : null;
}

// ---------------------------------------------------------------------------
// Knockout rendering.
// ---------------------------------------------------------------------------

function KnockoutView({ matches }: { matches: BracketMatch[] }) {
  if (matches.length === 0) return null;
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  return (
    <div className="flex gap-6 overflow-x-auto pb-2">
      {rounds.map((r) => {
        const roundMatches = matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot);
        return (
          <div key={r} className="flex min-w-56 flex-col justify-around gap-4">
            <p className="eyebrow text-center">{roundMatches[0]?.label ?? `Round ${r + 1}`}</p>
            {roundMatches.map((m) => (
              <KnockoutMatchCard key={m._id} match={m} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function KnockoutMatchCard({ match }: { match: BracketMatch }) {
  const editable = !!match.teamAId && !!match.teamBId && !match.isBye;
  return (
    <Card className="overflow-hidden p-0">
      <CardContent className="flex flex-col gap-px p-0">
        <KnockoutTeamLine
          name={match.teamAName}
          source={match.teamASource}
          score={match.scoreA}
          isWinner={!!match.winnerTeamId && match.winnerTeamId === match.teamAId}
        />
        <div className="h-px bg-border" />
        <KnockoutTeamLine
          name={match.teamBName}
          source={match.teamBSource}
          score={match.scoreB}
          isWinner={!!match.winnerTeamId && match.winnerTeamId === match.teamBId}
          isBye={match.isBye && !match.teamBId}
        />
      </CardContent>
      {editable && <ScoreEntry match={match} requireWinner />}
    </Card>
  );
}

function KnockoutTeamLine({
  name,
  source,
  score,
  isWinner,
  isBye,
}: {
  name: string | null;
  source?: string;
  score?: number;
  isWinner?: boolean;
  isBye?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-3 py-2 text-sm',
        isWinner && 'bg-positive/10',
      )}
    >
      <span className={cn('flex items-center gap-1.5 truncate', isWinner ? 'font-semibold' : '')}>
        {isWinner && <Crown className="size-3.5 shrink-0 text-positive" />}
        <span className="truncate">
          {name ?? (isBye ? 'Bye' : (source ?? 'TBD'))}
        </span>
      </span>
      {score !== undefined && (
        <span className="tnum shrink-0 font-semibold tabular-nums">{score}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group stage / round robin rendering.
// ---------------------------------------------------------------------------

function RoundRobinView({ data }: { data: ViewData }) {
  const fixtures = data.matches.filter((m) => m.stage === 'group');
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div>
        <h3 className="eyebrow mb-3">Standings</h3>
        {data.standings[0] && <StandingsTable rows={data.standings[0].rows} />}
      </div>
      <div>
        <h3 className="eyebrow mb-3">Fixtures</h3>
        <FixtureList matches={fixtures} />
      </div>
    </div>
  );
}

function GroupStageView({ data }: { data: ViewData }) {
  const groups = data.standings;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {groups.map((g) => {
        const fixtures = data.matches.filter(
          (m) => m.stage === 'group' && (m.groupIndex ?? 0) === g.groupIndex,
        );
        return (
          <div key={g.groupIndex} className="rounded-lg border border-border bg-surface-2 p-4">
            <h3 className="eyebrow mb-3">{g.label}</h3>
            <StandingsTable rows={g.rows} highlight={data.bracket.advancePerGroup ?? 0} />
            <h4 className="eyebrow mt-4 mb-2 text-muted-foreground/70">Fixtures</h4>
            <FixtureList matches={fixtures} compact />
          </div>
        );
      })}
    </div>
  );
}

function StandingsTable({ rows, highlight = 0 }: { rows: StandingRow[]; highlight?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 pr-2 font-medium">#</th>
            <th className="py-1 pr-2 font-medium">Team</th>
            <th className="px-1 py-1 text-center font-medium" title="Played">P</th>
            <th className="px-1 py-1 text-center font-medium" title="Won">W</th>
            <th className="px-1 py-1 text-center font-medium" title="Drawn">D</th>
            <th className="px-1 py-1 text-center font-medium" title="Lost">L</th>
            <th className="px-1 py-1 text-center font-medium" title="Goal difference">GD</th>
            <th className="px-1 py-1 text-center font-medium" title="Points">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.teamId}
              className={cn(
                'border-t border-border/60',
                highlight > 0 && i < highlight && 'bg-positive/10',
              )}
            >
              <td className="py-1.5 pr-2 text-muted-foreground tabular-nums">{i + 1}</td>
              <td className="py-1.5 pr-2 font-medium">{r.name}</td>
              <td className="px-1 py-1.5 text-center tabular-nums">{r.played}</td>
              <td className="px-1 py-1.5 text-center tabular-nums">{r.win}</td>
              <td className="px-1 py-1.5 text-center tabular-nums">{r.draw}</td>
              <td className="px-1 py-1.5 text-center tabular-nums">{r.loss}</td>
              <td className="px-1 py-1.5 text-center tabular-nums">
                {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
              </td>
              <td className="px-1 py-1.5 text-center font-semibold tabular-nums">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FixtureList({ matches, compact }: { matches: BracketMatch[]; compact?: boolean }) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  return (
    <div className="flex flex-col gap-3">
      {rounds.map((r) => (
        <div key={r}>
          {!compact && (
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Round {r + 1}</p>
          )}
          <div className="flex flex-col gap-1.5">
            {matches
              .filter((m) => m.round === r)
              .sort((a, b) => a.slot - b.slot)
              .map((m) => (
                <FixtureRow key={m._id} match={m} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FixtureRow({ match }: { match: BracketMatch }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-surface px-2.5 py-1.5 text-sm">
      <span
        className={cn(
          'flex-1 truncate text-right',
          match.winnerTeamId === match.teamAId && 'font-semibold text-positive',
        )}
      >
        {match.teamAName ?? '—'}
      </span>
      <ScoreEntry match={match} inline />
      <span
        className={cn(
          'flex-1 truncate',
          match.winnerTeamId === match.teamBId && 'font-semibold text-positive',
        )}
      >
        {match.teamBName ?? '—'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score entry — used by both knockout cards and group fixtures.
// ---------------------------------------------------------------------------

function ScoreEntry({
  match,
  requireWinner,
  inline,
}: {
  match: BracketMatch;
  requireWinner?: boolean;
  inline?: boolean;
}) {
  const recordScore = useMutation(api.bracket.recordScore);
  const [a, setA] = useState(match.scoreA?.toString() ?? '');
  const [b, setB] = useState(match.scoreB?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  const dirty = a !== (match.scoreA?.toString() ?? '') || b !== (match.scoreB?.toString() ?? '');
  const filled = a !== '' && b !== '';

  async function save() {
    if (!filled) return;
    const sa = Number(a);
    const sb = Number(b);
    if (requireWinner && sa === sb) {
      toast.error('A knockout match needs a winner');
      return;
    }
    setSaving(true);
    try {
      await recordScore({ matchId: match._id, scoreA: sa, scoreB: sb });
      toast.success('Result saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save result');
      setA(match.scoreA?.toString() ?? '');
      setB(match.scoreB?.toString() ?? '');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1',
        inline ? '' : 'border-t border-border bg-surface-2/50 px-2 py-1.5',
      )}
    >
      <Input
        type="number"
        min={0}
        value={a}
        onChange={(e) => setA(e.target.value)}
        aria-label="Score for first team"
        className="h-7 w-11 px-1 text-center tabular-nums"
      />
      <span className="text-xs text-muted-foreground">–</span>
      <Input
        type="number"
        min={0}
        value={b}
        onChange={(e) => setB(e.target.value)}
        aria-label="Score for second team"
        className="h-7 w-11 px-1 text-center tabular-nums"
      />
      <Button
        size="icon"
        variant={dirty && filled ? 'default' : 'ghost'}
        className="size-7"
        disabled={!filled || !dirty || saving}
        onClick={() => void save()}
        title="Save result"
      >
        <Check className="size-3.5" />
      </Button>
    </div>
  );
}
