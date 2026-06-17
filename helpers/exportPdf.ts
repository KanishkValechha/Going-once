import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatAmount } from './format';

/** Shape returned by `api.exports.auctionSummary`. */
export type AuctionSummary = {
  tournamentName: string;
  rosterSize: number;
  teams: {
    name: string;
    captainName: string | null;
    remainingBudget: number;
    spent: number;
    playerCount: number;
    roster: { name: string; role: string | null; price: number; isCaptain: boolean }[];
  }[];
  unsold: { name: string; role: string | null }[];
};

const INK = '#0f1117';
const MUTED = '#6b7280';
const ACCENT: [number, number, number] = [37, 99, 235];

/**
 * Build and download the auction-results PDF: a cover line, then one block per
 * team (captain, spend, remaining budget, full roster table), then any unsold
 * players. Text is drawn natively so it stays crisp and selectable.
 */
export function downloadAuctionPdf(summary: AuctionSummary) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(INK);
  doc.text(summary.tournamentName, margin, 56);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(MUTED);
  doc.text(
    `Auction results · ${summary.teams.length} teams · roster size ${summary.rosterSize}`,
    margin,
    74,
  );

  let cursorY = 96;

  for (const team of summary.teams) {
    // Keep a team's heading with at least its first rows on the same page.
    if (cursorY > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      cursorY = 56;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(INK);
    doc.text(team.name, margin, cursorY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(MUTED);
    const meta = [
      team.captainName ? `Captain: ${team.captainName}` : 'No captain',
      `Players: ${team.playerCount}`,
      `Spent: ${formatAmount(team.spent)}`,
      `Remaining: ${formatAmount(team.remainingBudget)}`,
    ].join('     ');
    doc.text(meta, margin, cursorY + 16);

    autoTable(doc, {
      startY: cursorY + 26,
      margin: { left: margin, right: margin },
      head: [['#', 'Player', 'Role', 'Price']],
      body:
        team.roster.length > 0
          ? team.roster.map((p, i) => [
              String(i + 1),
              p.isCaptain ? `${p.name}  (C)` : p.name,
              p.role ?? '—',
              formatAmount(p.price),
            ])
          : [['—', 'No players bought', '', '']],
      foot:
        team.roster.length > 0
          ? [['', 'Total', '', formatAmount(team.spent)]]
          : undefined,
      styles: { fontSize: 9, cellPadding: 4, textColor: INK },
      headStyles: { fillColor: ACCENT, textColor: '#ffffff', fontStyle: 'bold' },
      footStyles: { fillColor: '#eef2ff', textColor: INK, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 28, halign: 'right' },
        3: { halign: 'right', cellWidth: 90 },
      },
      theme: 'striped',
    });

    // jspdf-autotable records where the last table ended.
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
  }

  if (summary.unsold.length > 0) {
    if (cursorY > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      cursorY = 56;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(INK);
    doc.text('Unsold players', margin, cursorY);
    autoTable(doc, {
      startY: cursorY + 12,
      margin: { left: margin, right: margin },
      head: [['Player', 'Role']],
      body: summary.unsold.map((p) => [p.name, p.role ?? '—']),
      styles: { fontSize: 9, cellPadding: 4, textColor: INK },
      headStyles: { fillColor: [107, 114, 128], textColor: '#ffffff', fontStyle: 'bold' },
      theme: 'striped',
    });
  }

  // Footer page numbers.
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - margin,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'right' },
    );
  }

  const safeName = summary.tournamentName.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
  doc.save(`${safeName || 'auction'}-results.pdf`);
}
