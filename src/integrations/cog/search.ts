import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

/**
 * R33 — find that line.
 *
 * One request searches everything inside a single song: lyrics, notes, idea
 * cards, captures, and take names. Each hit ships with a 120-char snippet and
 * the offset of the match inside it, so the UI can bold the term without
 * re-scanning the text. Lyrics rank first, then ideas, notes, takes.
 */

export type SearchSource = "lyric" | "note" | "card" | "take" | "capture";

export type SearchHit = {
  source: SearchSource;
  entity_id: string;
  title: string;
  snippet: string;
  /** Character offset of the match inside `snippet`. */
  match_at: number;
  match_len: number;
  updated_at: string;
};

export type SongSearchResult = {
  song_id: string;
  q: string;
  rows: SearchHit[];
};

export async function searchSong(
  songId: string,
  q: string,
  limit = 20,
): Promise<SongSearchResult> {
  const { data, error } = await (supabase as any).rpc("song_search", {
    _song_id: songId,
    _q: q,
    _limit: limit,
  });
  if (error) {
    if (String(error.message).includes("forbidden"))
      throw new Error("You're not in this song.");
    throw toCogError(error);
  }
  return data as SongSearchResult;
}

/** Where a hit lives, for one-tap navigation. */
export function searchHitHref(songId: string, hit: SearchHit): string {
  switch (hit.source) {
    case "lyric":
      return `/songs/${songId}/sheet#section-${hit.entity_id}`;
    case "note":
      return `/songs/${songId}/notes#note-${hit.entity_id}`;
    case "card":
    case "capture":
      return `/songs/${songId}/canvas?card=${hit.entity_id}`;
    case "take":
      return `/songs/${songId}/voice?take=${hit.entity_id}`;
    default:
      return `/songs/${songId}`;
  }
}

/** Split a snippet into [before, match, after] for bolding, no regex needed. */
export function splitHit(hit: SearchHit): [string, string, string] {
  const a = Math.max(hit.match_at, 0);
  const b = a + hit.match_len;
  return [hit.snippet.slice(0, a), hit.snippet.slice(a, b), hit.snippet.slice(b)];
}
