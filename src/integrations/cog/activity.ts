/**
 * Activity feed — re-exported under the names the Catalog/Workspace handoff
 * doc promised Claude. Payloads are IDs + event kinds only (no raw lyric
 * or memo content) — that's a hard product rule.
 */
export type { SongActivityRow as ActivityEvent } from "./songs";
export { getSongActivity as getRecentActivity } from "./songs";

import { getSongActivity, type SongActivityRow } from "./songs";
import { supabase } from "@/integrations/supabase/client";

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
  if (error) throw error;
  return (data ?? []) as ActivityDigestRow[];
}

/** Update the caller's last_seen_at for a song (for "what changed since you left"). */
export async function markSongSeen(song_id: string): Promise<void> {
  const { error } = await (supabase as any).rpc("mark_song_seen", { _song_id: song_id });
  if (error) throw error;
}

export type RecapDigest = { digest: string; rows: ActivityDigestRow[] };

/** AI-generated one-paragraph recap of activity since a timestamp. */
export async function getRecapDigest(song_id: string, since?: string): Promise<RecapDigest> {
  const { data, error } = await supabase.functions.invoke<RecapDigest>("digest-recap", {
    body: { song_id, since },
  });
  if (error) throw error;
  if (!data) throw new Error("digest-recap returned no data");
  return data;
}