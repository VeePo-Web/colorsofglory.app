/**
 * Activity feed — re-exported under the names the Catalog/Workspace handoff
 * doc promised Claude. Payloads are IDs + event kinds only (no raw lyric
 * or memo content) — that's a hard product rule.
 */
export type { SongActivityRow as ActivityEvent } from "./songs";
export { getSongActivity as getRecentActivity } from "./songs";

import { getSongActivity, type SongActivityRow } from "./songs";
import { supabase } from "@/integrations/supabase/client";
import { CogError, call, toCogError } from "./errors";

/** Convenience filter: activity newer than a given ISO timestamp. */
export async function getActivitySince(
  songId: string,
  sinceISO: string | null,
): Promise<SongActivityRow[]> {
  const all = await getSongActivity(songId, 50, 0);
  if (!sinceISO) return all;
  const since = new Date(sinceISO).getTime();
  return all.filter((row) => new Date(row.created_at).getTime() > since);
}

// ---------- Step 3: realtime activity layer ----------

export type SongActivityKind =
  | "take_committed"
  | "capture_created"
  | "capture_promoted"
  | "memo_uploaded"
  | "memo_finalized"
  | "memo_transcribed"
  | "invite_accepted"
  | "member_left"
  | "owner_transferred"
  | "card_moved"
  | "card_linked"
  | "card_unlinked"
  | "card_grouped"
  | "card_section_set"
  | "card_promoted_final"
  | "card_deleted";

export type ActivityDigestRow = {
  kind: SongActivityKind;
  actor_user_id: string | null;
  event_count: number;
  last_at: string;
  sample_entity_ids: string[] | null;
};

/** Grouped digest of activity in a song since a timestamp (membership-gated). */
export async function listActivitySince(
  song_id: string,
  since: string,
  limit = 200,
): Promise<ActivityDigestRow[]> {
  const { data, error } = await (supabase as any).rpc("list_song_activity_since", {
    _song_id: song_id,
    _since: since,
    _limit: limit,
  });
  if (error) throw toCogError(error);
  return (data ?? []) as ActivityDigestRow[];
}

/** Update the caller's last_seen_at for a song (for "what changed since you left"). */
export async function markSongSeen(song_id: string): Promise<void> {
  const { error } = await (supabase as any).rpc("mark_song_seen", { _song_id: song_id });
  if (error) throw toCogError(error);
}

/**
 * Read the caller's server-side last_seen_at for a song — the recap anchor on
 * a NEW device (where the local anchor doesn't exist yet). markSongSeen has
 * been writing this all along; this is the read half.
 */
export async function getSongLastSeen(song_id: string): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("song_notification_prefs")
    .select("last_seen_at")
    .eq("song_id", song_id)
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw toCogError(error);
  return data?.last_seen_at ?? null;
}

export type RecapDigest = { digest: string; rows: ActivityDigestRow[] };

/** AI-generated one-paragraph recap of activity since a timestamp. */
export async function getRecapDigest(song_id: string, since?: string): Promise<RecapDigest> {
  const data = await call<RecapDigest>("digest-recap", { song_id, since });
  if (!data) throw new CogError("INTERNAL", "digest-recap returned no data");
  return data;
}
// ---------- Grouped feed (R11) ----------

export type GroupedFeedEntry = {
  actor_user_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  actor_color: string | null;
  kind: string;
  entity_type: string;
  /** How many raw events collapsed into this line. 1 means no collapsing. */
  item_count: number;
  first_at: string;
  last_at: string;
  /** Up to 8 most recent entity ids in the group, for expand-on-tap. */
  entity_ids: string[];
  activity_ids: string[];
  is_self: boolean;
};

export type GroupedFeed = {
  entries: GroupedFeedEntry[];
  server_time: string;
};

/**
 * The feed as a person reads it, not as the database wrote it. Same actor +
 * same kind inside a 10-minute window collapses to one entry with a count.
 * Page backwards by passing the oldest `last_at` you have as `before`.
 */
export async function getGroupedFeed(
  song_id: string,
  before?: string,
  limit = 30,
): Promise<GroupedFeed> {
  const { data, error } = await (supabase as any).rpc("song_feed_grouped", {
    _song_id: song_id,
    _before: before ?? null,
    _limit: limit,
  });
  if (error) throw toCogError(error);
  return data as GroupedFeed;
}
