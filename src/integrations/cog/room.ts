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
import { toCogError } from "./errors";
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
