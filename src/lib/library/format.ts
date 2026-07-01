/** Friendly relative time for the library — "2h ago", "Yesterday", "Jun 3". */
export function relativeDate(iso: string | null): string {
  if (!iso) return "Just now";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Cover swatch color for a song card — the song's own color, else warm gold. */
export function coverColor(raw: string | null): string {
  return raw && raw.trim() ? raw : "var(--cog-gold-pale)";
}
