/**
 * Pending line suggestions (Feature 19) — the frontend store.
 *
 * Two lanes:
 *  - SERVER lane: when the target lyric is a server card (db-card-*), the
 *    suggestion travels as a CARRIER ROW in canvas_cards (kind "idea",
 *    section_kind "line_suggestion", parent_card_id = the target, body = the
 *    JSON payload below). It reaches the owner's phone through the exact
 *    hydrate + realtime path every other card uses — no new table needed
 *    (song_suggestions remains the proper long-term home; this is the bridge).
 *  - LOCAL lane: local-card targets, the demo room, and failed inserts keep
 *    the localStorage outbox so a proposal is never lost ("a captured idea is
 *    never lost" creed).
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
  /** This suggestion lives as a canvas_cards carrier row (id = the row uuid);
   *  resolving it deletes that row so it leaves every device's queue. */
  fromServer?: boolean;
  /** Proposer's user id (server lane) — names resolve through the roster. */
  createdBy?: string;
}

/** section_kind marker for carrier rows — hydrateBoard routes these OFF the
 *  board and into the suggestions store. */
export const SUGGESTION_SECTION_KIND = "line_suggestion";

export interface SuggestionPayload {
  originalLine: string;
  proposedLine: string;
  section: string;
  contributor: string;
}

export const encodeSuggestion = (p: SuggestionPayload): string => JSON.stringify(p);

export function decodeSuggestion(body: string): SuggestionPayload | null {
  try {
    const p = JSON.parse(body) as SuggestionPayload;
    if (typeof p?.proposedLine !== "string" || typeof p?.originalLine !== "string") return null;
    return { ...p, section: p.section ?? "", contributor: p.contributor ?? "" };
  } catch {
    return null;
  }
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
