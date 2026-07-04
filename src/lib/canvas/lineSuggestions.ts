/**
 * Pending line suggestions (Feature 19) — the frontend store.
 *
 * When a co-writer proposes a replacement for one lyric line, it can't just
 * toast and vanish (the owner must decide). Until the backend owns this, each
 * suggestion is persisted locally per song so it survives a reload and shows
 * up in the owner's review queue. Same "a captured idea is never lost" creed
 * as the pending-upload cache; kept deliberately tiny and synchronous.
 */

export interface PendingLineSuggestion {
  id: string;
  songId: string;
  /** Canvas card (lyric) this suggestion replaces the body of. */
  cardId: string;
  originalLine: string;
  proposedLine: string;
  contributor: string;
  section: string;
  createdAt: number;
}

const KEY = (songId: string) => `cog:line-suggestions-${songId}`;

function readAll(songId: string): PendingLineSuggestion[] {
  try {
    const raw = localStorage.getItem(KEY(songId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingLineSuggestion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(songId: string, list: PendingLineSuggestion[]): void {
  try {
    localStorage.setItem(KEY(songId), JSON.stringify(list));
  } catch {
    // Storage full / unavailable — the suggestion just isn't persisted; the
    // owner's live in-memory copy (returned by addLineSuggestion) still holds.
  }
}

export function listLineSuggestions(songId: string): PendingLineSuggestion[] {
  return readAll(songId);
}

export function addLineSuggestion(
  input: Omit<PendingLineSuggestion, "id" | "createdAt"> & { createdAt: number; id: string },
): PendingLineSuggestion[] {
  const list = readAll(input.songId);
  const next = [input, ...list];
  writeAll(input.songId, next);
  return next;
}

export function removeLineSuggestion(songId: string, id: string): PendingLineSuggestion[] {
  const next = readAll(songId).filter((s) => s.id !== id);
  writeAll(songId, next);
  return next;
}
