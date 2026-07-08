// Song domain types.
//
// PROVENANCE:
//   Song      — 1:1 ROW ALIAS of public.songs.
//   SongCard  — COMPOSED read view (list-songs RPC): songs + my_role + rolled-up
//               voice_memo/collaborator counts. Not a single row.
//   SongDetail — COMPOSED read view (get_song RPC): a songs row + my_role + a
//               nested per-room `counts` object aggregated across song_sections,
//               song_lyrics, voice_memos, song_notes, song_members, song_suggestions.
//   SongActivityRow / SongNotificationPrefs — COMPOSED RPC read shapes.
// Enum fields derive from the canonical ./enums + ./role homes.
import type { Database } from "@/integrations/supabase/types";
import type { SongStatus } from "./enums";
import type { SongMemberRole } from "./role";

export type Song = Database["public"]["Tables"]["songs"]["Row"];

/** Minimal shape for the Song Catalog grid. */
export type SongCard = {
  id: string;
  title: string;
  cover_color: string | null;
  status: SongStatus;
  last_activity_at: string | null;
  created_at: string;
  my_role: SongMemberRole;
  voice_memo_count: number;
  collaborator_count: number;
};

/** Full song + per-room counts for the Workspace hub. */
export type SongDetail = {
  id: string;
  owner_user_id: string;
  title: string;
  status: SongStatus;
  key_signature: string | null;
  tempo_bpm: number | null;
  time_signature: string | null;
  tags: string[] | null;
  cover_color: string | null;
  is_locked: boolean;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  lyrics_snippet: string | null;
  my_role: SongMemberRole;
  counts: {
    sections: number;
    lyrics_filled: number;
    voice_memos: number;
    notes: number;
    collaborators: number;
    pending_suggestions: number;
  };
};

/** One row of the song activity feed (IDs + kinds only — never raw content). */
export type SongActivityRow = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_color: string | null;
  payload: Record<string, unknown>;
};

/** Per-song notification preferences for the signed-in user. */
export type SongNotificationPrefs = {
  user_id: string;
  song_id: string;
  notify_on_join: boolean;
  notify_on_contribution: boolean;
  push_enabled: boolean;
};
