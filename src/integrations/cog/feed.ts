import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

/**
 * R32 — the song feed.
 *
 * One request paints the whole feed: the actor's name and avatar colour, a
 * short human label for the thing that changed, and a jump target so every
 * row is tappable. Consecutive same-kind events by the same person inside a
 * 10-minute window collapse into a single counted row, so the feed stays
 * calm. Labels only — never lyric or recording content.
 */

export type FeedActor = {
  user_id: string;
  name: string;
  avatar_url: string | null;
  avatar_color: string | null;
};

export type FeedTargetView =
  | "sheet"
  | "canvas"
  | "takes"
  | "notes"
  | "suggestions"
  | "people";

export type FeedTarget = { view: FeedTargetView; id: string };

export type FeedRow = {
  row_key: string;
  kind: string;
  entity_type: string;
  entity_id: string | null;
  event_count: number;
  created_at: string;
  is_unseen: boolean;
  is_you: boolean;
  actor: FeedActor | null;
  label: string | null;
  target: FeedTarget | null;
};

export type SongFeed = {
  song_id: string;
  last_seen_at: string | null;
  rows: FeedRow[];
  has_more: boolean;
};

export async function fetchSongFeed(
  songId: string,
  opts: { limit?: number; before?: string | null } = {},
): Promise<SongFeed> {
  const { data, error } = await (supabase as any).rpc("song_feed", {
    _song_id: songId,
    _limit: opts.limit ?? 40,
    _before: opts.before ?? null,
  });
  if (error) {
    if (String(error.message).includes("forbidden"))
      throw new Error("You're not in this song.");
    throw toCogError(error);
  }
  return data as SongFeed;
}

/** Route for a feed row's jump target, or null when the row isn't tappable. */
export function feedRowHref(songId: string, row: FeedRow): string | null {
  if (!row.target) return null;
  const { view, id } = row.target;
  switch (view) {
    case "sheet":
      return `/songs/${songId}/sheet#section-${id}`;
    case "canvas":
      return `/songs/${songId}/canvas?card=${id}`;
    case "takes":
      return `/songs/${songId}/voice?take=${id}`;
    case "notes":
      return `/songs/${songId}/notes#note-${id}`;
    case "suggestions":
      return `/songs/${songId}/sheet?suggestion=${id}`;
    case "people":
      return `/songs/${songId}/people`;
    default:
      return null;
  }
}

/** Rows above the fold that the writer hasn't seen yet. */
export function unseenCount(feed: SongFeed): number {
  return feed.rows.filter((r) => r.is_unseen && !r.is_you).length;
}
