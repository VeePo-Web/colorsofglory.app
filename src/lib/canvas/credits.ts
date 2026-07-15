/**
 * Credits deriver (COG Product 13 — Contribution Ledger).
 *
 * "Collaboration feels fair and remembered." Reads the song's canvas cards
 * (the same localStorage the room writes) and rolls each contributor's work
 * up into plain-language contribution labels — Lyrics, Voice memos, Chords,
 * Arrangement — so every hand that touched the song is recognised. Frontend
 * only; the backend ledger will supersede this, but a captured contribution
 * is never forgotten in the meantime.
 */

interface StoredCard {
  type?: string;
  contributor?: string;
  parentMemoId?: string;
  section?: string;
}

export interface CreditEntry {
  name: string;
  contributions: string[];
}

const CARDS_KEY = (songId: string) => `cog:canvas-cards-${songId}`;

// Card type → the plural label shown as a contribution chip.
const LABEL_BY_TYPE: Record<string, string> = {
  voice: "Voice memos",
  hum: "Voice memos",
  lyric: "Lyrics",
  chord: "Chords",
  note: "Ideas",
  scripture: "Scripture",
  section: "Arrangement",
};

export function deriveCredits(songId: string): CreditEntry[] {
  let cards: StoredCard[] = [];
  try {
    const raw = localStorage.getItem(CARDS_KEY(songId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) cards = parsed as StoredCard[];
    }
  } catch {
    return [];
  }

  // contributor → { label → count }
  const byPerson = new Map<string, Map<string, number>>();
  for (const c of cards) {
    const name = c.contributor?.trim();
    if (!name) continue;
    const label = LABEL_BY_TYPE[c.type ?? ""] ?? "Ideas";
    const counts = byPerson.get(name) ?? new Map<string, number>();
    counts.set(label, (counts.get(label) ?? 0) + 1);
    byPerson.set(name, counts);
  }

  return Array.from(byPerson.entries()).map(([name, counts]) => ({
    name,
    // "Voice memos ×3" when more than one; plain label otherwise. Ordered by
    // volume so a person's biggest contribution reads first.
    contributions: Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, n]) => (n > 1 ? `${label} ×${n}` : label)),
  }));
}

/** Plain-text credits block for the clipboard / share (client-side export). */
export function creditsToText(
  songTitle: string,
  entries: CreditEntry[],
  /** The song's "for …" — a dedicatory TOP-LINE under the title (like a record
   *  sleeve), never a contributor row. Omitted entirely when unset. */
  dedication?: string | null,
): string {
  const lines = [`Credits — ${songTitle}`];
  if (dedication) lines.push(`for ${dedication}`);
  lines.push("");
  for (const e of entries) {
    lines.push(`${e.name}: ${e.contributions.join(", ")}`);
  }
  lines.push("", "Made with Colors of Glory");
  return lines.join("\n");
}
