'use client';

import { useState } from 'react';
import { useConvex } from 'convex/react';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { downloadAuctionPdf } from '@/helpers/exportPdf';

/** Card that exports the finished auction (teams, rosters, prices) as a PDF. */
export function AuctionExport({ tournamentId }: { tournamentId: Id<'tournaments'> }) {
  const convex = useConvex();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const summary = await convex.query(api.exports.auctionSummary, { tournamentId });
      if (summary.teams.length === 0) {
        toast.error('No teams to export yet');
        return;
      }
      downloadAuctionPdf(summary);
      toast.success('Auction results downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not build the PDF');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileDown className="size-4 text-accent" /> Auction results PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Download every team with its captain, full roster, the price each player sold for, total
          spend, and remaining budget — plus any unsold players.
        </p>
        <Button onClick={() => void download()} disabled={busy} className="self-start">
          <FileDown className="size-4" /> {busy ? 'Preparing…' : 'Download PDF'}
        </Button>
      </CardContent>
    </Card>
  );
}
