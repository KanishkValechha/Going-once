/** Format an auction amount/budget with thousands separators. */
export function formatAmount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

/** Remaining required roster slots for a team. */
export function remainingSlots(rosterSize: number, playersWon: number): number {
  return Math.max(0, rosterSize - playersWon);
}

/**
 * A short 3-letter code for a team, derived from its name (no stored field).
 * Uses initials when the name has multiple words ("Royal Stags" → "RS"),
 * otherwise the first three letters ("Strikers" → "STR").
 */
export function teamCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((w) => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
  }
  return (words[0] ?? '').slice(0, 3).toUpperCase() || '?';
}

/** Initials for a person's name, e.g. "Virat Kohli" → "VK". */
export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}
