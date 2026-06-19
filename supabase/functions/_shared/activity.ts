import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

/**
 * Insert a row into public.song_activity. ID-only payloads — never include
 * lyric text, memo titles, or transcript content (Core privacy rule).
 * Failures are swallowed: activity logging must never break the write path.
 */
export async function logActivity(
  admin: SupabaseClient,
  args: {
    song_id: string | null | undefined;
    actor_user_id: string;
    kind: SongActivityKind;
    entity_type: string;
    entity_id?: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  if (!args.song_id) return;
  try {
    await admin.from("song_activity").insert({
      song_id: args.song_id,
      actor_user_id: args.actor_user_id,
      kind: args.kind,
      entity_type: args.entity_type,
      entity_id: args.entity_id ?? null,
      payload: args.payload ?? {},
    });
  } catch (e) {
    console.warn("log_song_activity_failed", (e as Error)?.message);
  }
}