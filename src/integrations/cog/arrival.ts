/**
 * R56 — "The first ten seconds."
 *
 * Every other module here serves someone who already knows this song. This one
 * serves the person who has never seen it: the co-writer who just tapped an
 * invite link and landed inside somebody else's unfinished work.
 *
 * `song_arrival` answers, in ONE request, the four questions a stranger asks
 * silently in their first seconds — whose song is this, what's already here,
 * what am I allowed to touch, and what do I do first — and stamps the visit so
 * the welcome can only ever happen once per person per song.
 *
 * It returns sentences, not fields: `room_line`, `permission_line` and one
 * `first_move`. The UI prints them. It does not build copy from counters, and
 * it never shows a role name ("collaborator" means nothing to a first-timer).
 *
 * No lyric text ever crosses this boundary.
 */
import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export type ArrivalMoveKind = "listen" | "read" | "first_part" | "fill_part" | "record";
export type ArrivalTarget = "takes" | "sheet" | "section" | "section_new" | "record";

export type ArrivalMove = {
  kind: ArrivalMoveKind;
  /** One plain sentence. Print it verbatim. */
  headline: string;
  /** Two or three words for the single button. Always a verb. */
  action: string;
  target_type: ArrivalTarget;
  target_id: string | null;
};

export type SongArrival = {
  /** True exactly once per person per song. Gate the welcome on this alone. */
  first_visit: boolean;
  song_id: string;
  title: string;
  is_owner: boolean;
  owner_name: string;
  /** Who pulled them in, when we know. Null for the owner or a legacy member. */
  invited_by_name: string | null;
  people_count: number;
  /** "3 parts and 2 recordings." — what's already in the room. */
  room_line: string;
  /** "You can write, record and comment here." — capability, never a role. */
  permission_line: string;
  first_move: ArrivalMove;
};

/**
 * Open the room as this person, right now.
 *
 * Call it ONCE, in parallel with the room bootstrap — never after it, never
 * blocking paint. If `first_visit` is false, throw the result away and render
 * the room as normal: the welcome is a one-time event, not a screen.
 *
 * Failures are silent by design; a stranger's first second should never be an
 * error state, so callers get `null` and simply skip the welcome.
 */
export async function getSongArrival(songId: string): Promise<SongArrival | null> {
  try {
    const { data, error } = await (supabase as any).rpc("song_arrival", { _song_id: songId });
    if (error) throw toCogError(error);
    return (data ?? null) as SongArrival | null;
  } catch {
    return null;
  }
}
