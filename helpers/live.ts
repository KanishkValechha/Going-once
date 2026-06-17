/** Build the distributable view-only live URL for a tournament's viewer token. */
export function buildLiveUrl(token: string, origin?: string): string {
  const base = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/live?token=${encodeURIComponent(token)}`;
}
