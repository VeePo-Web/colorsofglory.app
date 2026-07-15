import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CogError, toCogError, call } from "./errors";

// The error contract lives once in `./errors`; re-exported here so the many
// `@/integrations/cog/songs` importers (members/notes/versions) keep resolving
// CogError unchanged.
export { CogError, toCogError, call, codeFromServer } from "./errors";
export type { CogErrorCode } from "./errors";

export type Song = Database["public"]["Tables"]["songs"]["Row"];
export type SongInvite = Database["public"]["Tables"]["song_invites"]["Row"];
export type SongStatus = Database["public"]["Enums"]["song_status"];
export type SongMemberRole = Database["public"]["Enums"]["song_member_role"];

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
  /** Optional "for …" line; absent until list_my_songs returns the column. */
  dedication?: string | null;
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
  /** Optional one-line "for …" the song quietly remembers. */
  dedication: string | null;
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

export const createSong = (input: {
  title: string;
  key_signature?: string;
  tempo_bpm?: number;
  time_signature?: string;
  cover_color?: string;
  tags?: string[];
  /** Optional "for …" dedication, when the song is born already knowing it. */
  dedication?: string;
}) => call<{ song: Song }>("create-song", input);

/**
 * Point the signed-in user's profile at their first song so post-auth routing
 * (`routeAfterAuth`) can resume inside it. Fire-and-forget from onboarding;
 * `createSong` handles ownership + membership, this only sets the pointer.
 * No-ops when signed out.
 */
export const setFirstSong = async (song_id: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("profiles")
    .update({ first_song_id: song_id, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) throw toCogError(error);
};

export const deleteSong = (song_id: string) => call<{ ok: true }>("song-delete", { song_id });
export const leaveSong = (song_id: string) => call<void>("song-leave", { song_id });
export const transferOwner = (song_id: string, new_owner_user_id: string) =>
  call<void>("song-transfer-owner", { song_id, new_owner_user_id });
export const unarchiveSong = (song_id: string) => call<void>("song-unarchive", { song_id });

export const deleteVoiceMemo = (memo_id: string) =>
  call<{ ok: true }>("voice-memo-delete", { memo_id });

export const createInvite = (input: {
  song_id: string;
  role?: "collaborator" | "viewer";
  invited_email?: string;
  invited_phone?: string;
  max_uses?: number;
  message?: string;
}) => call<{ invite: SongInvite }>("song-invite-create", input);

export const acceptInvite = (token: string) =>
  call<{ song_id: string; role: string; already_member: boolean }>(
    "song-invite-accept",
    { token },
  );

export type InvitePreview = {
  song_id: string;
  song_title: string;
  lyrics_snippet: string | null;
  inviter_name: string;
  inviter_first_name: string;
  inviter_avatar_color: string | null;
  role: string;
  collaborator_count: number;
  collaborators: Array<{
    user_id: string;
    role: string;
    first_name: string | null;
    avatar_color: string | null;
    initials: string;
  }>;
  expires_at: string;
  uses_remaining: number;
};

export const previewInvite = (token: string) =>
  call<InvitePreview>("song-invite-preview", { token });

// --- Invite requests (expired/revoked link → "send me a new invite") ---

export const requestNewInvite = (input: {
  original_token: string;
  song_id?: string | null;
  phone?: string | null;
}) =>
  supabase.from("invite_requests").insert({
    original_token: input.original_token,
    song_id: input.song_id ?? null,
    requested_by_phone: input.phone ?? null,
  });

// --- Song activity feed (members only, IDs+kinds only — no raw content) ---

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

export const getSongActivity = async (song_id: string, limit = 50, offset = 0) => {
  const { data, error } = await supabase.rpc("get_song_activity", {
    _song_id: song_id,
    _limit: limit,
    _offset: offset,
  });
  if (error) throw toCogError(error);
  return (data ?? []) as SongActivityRow[];
};

// --- Per-song notification preferences ---

export type SongNotificationPrefs = {
  user_id: string;
  song_id: string;
  notify_on_join: boolean;
  notify_on_contribution: boolean;
  push_enabled: boolean;
};

export const getNotificationPrefs = async (song_id: string) => {
  const { data, error } = await supabase
    .from("song_notification_prefs")
    .select("*")
    .eq("song_id", song_id)
    .maybeSingle();
  if (error) throw toCogError(error);
  return (data ?? null) as SongNotificationPrefs | null;
};

export const upsertNotificationPrefs = async (
  song_id: string,
  patch: Partial<Pick<SongNotificationPrefs, "notify_on_join" | "notify_on_contribution" | "push_enabled">>,
) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new CogError("UNAUTHENTICATED");
  const { data, error } = await supabase
    .from("song_notification_prefs")
    .upsert({ user_id: user.id, song_id, ...patch }, { onConflict: "user_id,song_id" })
    .select()
    .maybeSingle();
  if (error) throw toCogError(error);
  return data as SongNotificationPrefs | null;
};

// --- Catalog + Workspace reads -------------------------------------------

/** Catalog: all songs the signed-in user is a member of, newest activity first. */
export const listMySongs = async (): Promise<SongCard[]> => {
  const { data, error } = await supabase.rpc("list_my_songs");
  if (error) throw toCogError(error);
  return (data ?? []) as SongCard[];
};

/** Workspace hub: full song + counts, or null when caller isn't a member. */
export const getSong = async (song_id: string): Promise<SongDetail | null> => {
  const { data, error } = await supabase
    .rpc("get_song_detail", { _song_id: song_id })
    .maybeSingle();
  if (error) throw toCogError(error);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    owner_user_id: row.owner_user_id as string,
    title: row.title as string,
    status: row.status as SongStatus,
    key_signature: (row.key_signature as string | null) ?? null,
    tempo_bpm: (row.tempo_bpm as number | null) ?? null,
    time_signature: (row.time_signature as string | null) ?? null,
    dedication: (row.dedication as string | null) ?? null,
    tags: (row.tags as string[] | null) ?? null,
    cover_color: (row.cover_color as string | null) ?? null,
    is_locked: Boolean(row.is_locked),
    last_activity_at: (row.last_activity_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    lyrics_snippet: (row.lyrics_snippet as string | null) ?? null,
    my_role: row.my_role as SongMemberRole,
    counts: {
      sections: Number(row.section_count ?? 0),
      lyrics_filled: Number(row.lyrics_filled_count ?? 0),
      voice_memos: Number(row.voice_memo_count ?? 0),
      notes: Number(row.note_count ?? 0),
      collaborators: Number(row.collaborator_count ?? 0),
      pending_suggestions: Number(row.pending_suggestion_count ?? 0),
    },
  };
};

/**
 * Archive a song (owner only — relies on existing RLS UPDATE policy).
 * Use `unarchiveSong` above to restore.
 */
export const archiveSong = async (song_id: string): Promise<void> => {
  const { error } = await supabase
    .from("songs")
    .update({ status: "archived" })
    .eq("id", song_id);
  if (error) throw toCogError(error);
};

/**
 * Rename a song (owner only — same RLS UPDATE policy as `archiveSong`).
 * Filed with A3 by F1 (catalog card actions); see docs/CATALOG-CONTRACT.md.
 */
export const renameSong = async (song_id: string, title: string): Promise<void> => {
  const { error } = await supabase
    .from("songs")
    .update({ title })
    .eq("id", song_id);
  if (error) throw toCogError(error);
};

/**
 * Set the song's canonical shared tempo. This is ASYNC tempo ALIGNMENT, not
 * real-time click sync: every collaborator's metronome reads this one BPM and
 * records locally against it (plus a bar-1 count-in), which is what makes
 * independent takes and layers tempo-compatible. Nobody's click is
 * network-phase-locked to anyone else's — that is infeasible over the
 * internet and unnecessary for COG's asynchronous collaboration. Do not
 * "upgrade" this to live cross-device click synchronization.
 *
 * Tapped or auto-detected BPMs are PROPOSALS — this function is called only
 * from an explicit confirm. The server (RLS) remains the permission gate;
 * the UI additionally hides the control from viewers.
 */
export const updateSongTempo = async (song_id: string, tempo_bpm: number): Promise<void> => {
  const { error } = await supabase
    .from("songs")
    .update({ tempo_bpm })
    .eq("id", song_id);
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
};

/**
 * Set the song's canonical key signature (app format: "G" majors, "Em"
 * minors). Same explicit-user-action contract as updateSongTempo — the sheet
 * (C3 transpose) and every "Key of …" surface read this one value.
 */
export const updateSongKeySignature = async (song_id: string, key_signature: string): Promise<void> => {
  const { error } = await supabase
    .from("songs")
    .update({ key_signature })
    .eq("id", song_id);
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
};

/**
 * Set (or clear, with null) the song's optional one-line dedication — the
 * quiet "for …" the header, credits, and export carry. Plain text, no
 * validation beyond the client's soft cap; null returns the song to
 * invisible. Callers go through lib/songs/dedication (offline-first,
 * unfailing) rather than calling this directly from components.
 */
export const setSongDedication = async (song_id: string, dedication: string | null): Promise<void> => {
  const { error } = await supabase
    .from("songs")
    .update({ dedication })
    .eq("id", song_id);
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
};

/**
 * F13 (auto tempo/key detection): fill tempo_bpm / key_signature ONLY where
 * the field is still NULL — enforced ATOMICALLY by the `.is(col, null)`
 * filter on each update, so a user-set value can never be overwritten even
 * if it lands between our read and write. Returns which fields were actually
 * filled. Best-effort by contract: callers treat any failure as "not filled"
 * (the suggestion still surfaces in the picker; the save never depended on
 * this).
 */
export const fillSongMusicIfEmpty = async (
  song_id: string,
  patch: { tempo_bpm?: number; key_signature?: string },
): Promise<{ filledBpm: boolean; filledKey: boolean }> => {
  const result = { filledBpm: false, filledKey: false };
  if (patch.tempo_bpm != null) {
    const { data, error } = await supabase
      .from("songs")
      .update({ tempo_bpm: patch.tempo_bpm })
      .eq("id", song_id)
      .is("tempo_bpm", null)
      .select("id");
    if (!error && (data?.length ?? 0) > 0) result.filledBpm = true;
  }
  if (patch.key_signature != null) {
    const { data, error } = await supabase
      .from("songs")
      .update({ key_signature: patch.key_signature })
      .eq("id", song_id)
      .is("key_signature", null)
      .select("id");
    if (!error && (data?.length ?? 0) > 0) result.filledKey = true;
  }
  return result;
};
