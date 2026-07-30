/**
 * CATALOG data seam (R23 · "What changed while you were gone").
 *
 * The song catalog is ONE request: `song_catalog_board`. It returns every song
 * you're a member of, ordered by last activity, with an unseen count computed
 * from your per-song `last_seen_at`. No lyric / note / memo content ever crosses
 * this boundary — counts, names and kinds only.
 */

import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export interface CatalogSongRow {
  id: string;
  title: string;
  status: string;
  cover_color: string | null;
  key_signature: string | null;
  tempo_bpm: number | null;
  lyrics_snippet: string | null;
  is_locked: boolean;
  last_activity_at: string;
  created_at: string;
  my_role: "owner" | "collaborator" | "viewer";
  is_owner: boolean;
  member_count: number;
  last_seen_at: string | null;
  unseen_count: number;
  last_event: { kind: string; actor_name: string | null; created_at: string } | null;
}

export interface CatalogBoard {
  songs: CatalogSongRow[];
  owned_count: number;
  total_unseen: number;
}

/** Everything the catalog screen needs, in ONE request. */
export async function getCatalogBoard(limit = 100): Promise<CatalogBoard> {
  const { data, error } = await supabase.rpc("song_catalog_board", { _limit: limit });
  if (error) throw toCogError(error);
  const board = (data ?? {}) as unknown as CatalogBoard;
  return {
    songs: board.songs ?? [],
    owned_count: board.owned_count ?? 0,
    total_unseen: board.total_unseen ?? 0,
  };
}

/** Mark one song as seen (call when the room opens). */
export async function markSongSeen(songId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_song_seen", { _song_id: songId });
  if (error) throw toCogError(error);
}

/** Clear every unseen marker at once. Returns rows touched. */
export async function markAllSongsSeen(): Promise<number> {
  const { data, error } = await supabase.rpc("mark_all_songs_seen");
  if (error) throw toCogError(error);
  return (data as unknown as number) ?? 0;
}
