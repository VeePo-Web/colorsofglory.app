/**
 * Song room bootstrap — ONE round trip for the whole room.
 *
 * Entering a song room previously fanned out into six independent queries
 * (song detail, members, canvas cards, voice memos, captures, activity).
 * On mobile that is six sequential TLS/RLS round trips before the room can
 * paint anything real. `song_room_bootstrap` is a single membership-gated
 * SECURITY DEFINER read that returns the same payload as one JSON object.
 *
 * Use it as the room's first paint source; keep the individual hooks for
 * incremental refreshes (realtime invalidation still targets their keys).
 */
import { supabase } from "@/integrations/supabase/client";
import { call, toCogError } from "./errors";
import type { CanvasCard } from "./canvas";

export type RoomMember = {
  user_id: string;
  role: string;
  joined_at: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
};

export type SongRoomBootstrap = {
  song: Record<string, unknown> | null;
  my_role: string | null;
  last_seen_at: string | null;
  members: RoomMember[];
  cards: CanvasCard[];
  memos: Record<string, unknown>[];
  captures: Record<string, unknown>[];
  sections: Record<string, unknown>[];
  unseen_activity_count: number;
};

/**
 * Fetch everything the room needs in one request.
 * Throws FORBIDDEN when the caller is not a member of the song.
 */
export async function getSongRoomBootstrap(
  song_id: string,
  card_limit = 400,
): Promise<SongRoomBootstrap> {
  const { data, error } = await (supabase as any).rpc("song_room_bootstrap", {
    _song_id: song_id,
    _card_limit: card_limit,
  });
  if (error) throw toCogError(error);
  return data as SongRoomBootstrap;
}

// ---------- Batch playback URLs ----------

export type SongPlaybackUrls = {
  /** memo id / take id → signed URL (15 min TTL). */
  urls: Record<string, string>;
  expires_in: number;
  count: number;
};

/**
 * Sign every take/memo in a song in ONE request.
 *
 * The per-card path (`voice-memo-signed-url`) costs a cold edge invocation at
 * the exact moment a thumb hits play. Prewarm the whole room with this on
 * entry and seed `canvasAudio`'s url cache; every subsequent tap is local.
 * Re-fetch every ~12 minutes (TTL is 15) while the room stays open.
 */
export async function getSongPlaybackUrls(
  song_id: string,
  memo_ids?: string[],
): Promise<SongPlaybackUrls> {
  const data = await call<SongPlaybackUrls>("song-playback-urls", { song_id, memo_ids });
  if (!data) return { urls: {}, expires_in: 0, count: 0 };
  return data;
}

// ---------- Incremental room delta ----------

export type SongRoomDelta = {
  /** Server clock at read time — pass this back as `since` on the next call. */
  server_time: string;
  since: string;
  cards: Record<string, unknown>[];
  memos: Record<string, unknown>[];
  takes: Record<string, unknown>[];
  captures: Record<string, unknown>[];
  activity: Record<string, unknown>[];
  /** A page was hit — fall back to a full bootstrap to re-sync. */
  truncated: boolean;
};

/**
 * "What changed since <ts>" for an open room.
 *
 * The room currently answers every realtime event with a FULL board refetch
 * (all cards + all memos + all captures, debounced 600ms). With three
 * co-writers active that is a whole-song read every 600ms on every device.
 * Call this instead: pass the previous response's `server_time`, apply the
 * returned rows by id, and reserve `getSongRoomBootstrap` for mount,
 * reconnect, and `truncated === true`.
 */
export async function getSongRoomDelta(
  song_id: string,
  since: string,
  limit = 200,
): Promise<SongRoomDelta> {
  const { data, error } = await (supabase as any).rpc("song_room_delta", {
    _song_id: song_id,
    _since: since,
    _limit: limit,
  });
  if (error) throw toCogError(error);
  return data as SongRoomDelta;
}

// ---------- Find + section vocabulary ----------

export type RoomSearchHit = {
  id: string;
  kind: string;
  label: string | null;
  body: string | null;
  section_kind: string | null;
  section_label: string | null;
  tree_kind: string;
  created_by: string | null;
  take_id: string | null;
  updated_at: string;
  rank: number;
};

/**
 * Find inside one song. Server-side so a long song stays findable without
 * holding every card in memory. Matches title, body and section label;
 * title-prefix matches rank highest. Terms under 2 chars return nothing —
 * filter the already-loaded feed locally for 1-char input instead.
 */
export async function searchSongRoom(
  song_id: string,
  q: string,
  limit = 40,
): Promise<RoomSearchHit[]> {
  const { data, error } = await (supabase as any).rpc("song_room_search", {
    _song_id: song_id,
    _q: q,
    _limit: limit,
  });
  if (error) throw toCogError(error);
  return ((data as any)?.results ?? []) as RoomSearchHit[];
}

export type SectionSummaryRow = {
  section: string;
  tree_kind: string;
  card_count: number;
  last_activity_at: string;
};

/**
 * The section vocabulary this song actually uses, with counts — the source
 * for section filter chips. Cheap enough to refresh alongside a delta.
 */
export async function getSongSectionSummary(song_id: string): Promise<SectionSummaryRow[]> {
  const { data, error } = await (supabase as any).rpc("song_section_summary", {
    _song_id: song_id,
  });
  if (error) throw toCogError(error);
  return ((data as any)?.sections ?? []) as SectionSummaryRow[];
}
