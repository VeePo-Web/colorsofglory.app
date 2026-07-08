import { supabase } from "@/integrations/supabase/client";
import { CogError } from "@/types";
import type {
  Song,
  SongCard,
  SongDetail,
  SongActivityRow,
  SongNotificationPrefs,
  SongStatus,
  SongMemberRole,
  SongInvite,
  InvitePreview,
  CogErrorCode,
} from "@/types";

// Domain types + the CogError class now live in the @/types barrel (A2 Steps 3
// & 7). Re-exported here so existing deep importers keep resolving until the
// Step 10 codemod repoints them.
export { CogError };
export type {
  Song,
  SongCard,
  SongDetail,
  SongActivityRow,
  SongNotificationPrefs,
  SongStatus,
  SongMemberRole,
  SongInvite,
  InvitePreview,
  CogErrorCode,
};

type Envelope<T> = { ok: boolean; code?: string; message?: string; data?: T };
type FunctionErrorContext = { json?: () => Promise<unknown> };
type FunctionInvokeError = { context?: FunctionErrorContext; message?: string };

async function call<T = unknown>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  let env = data as Envelope<T> | undefined;
  const functionError = error as FunctionInvokeError | null;
  // On non-2xx, supabase-js puts the Response on error.context; parse the body.
  if (functionError?.context && typeof functionError.context.json === "function") {
    try {
      env = (await functionError.context.json()) as Envelope<T>;
    } catch {
      /* ignore parse failure, fall through to generic error */
    }
  }
  // New-shape envelope
  if (env && typeof env === "object" && "ok" in env) {
    if (!env.ok) throw new CogError(env.code ?? "INTERNAL", env.message);
    return (env.data ?? env) as T;
  }
  if (error) throw new CogError("INTERNAL", error.message);
  // Legacy shape (function not yet migrated): pass through
  if ((data as { error?: string })?.error) throw new CogError("INTERNAL", (data as { error: string }).error);
  return data as T;
}

export const createSong = (input: {
  title: string;
  key_signature?: string;
  tempo_bpm?: number;
  time_signature?: string;
  cover_color?: string;
  tags?: string[];
}) => call<{ song: Song }>("create-song", input);

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

export const getSongActivity = async (song_id: string, limit = 50, offset = 0) => {
  const { data, error } = await supabase.rpc("get_song_activity", {
    _song_id: song_id,
    _limit: limit,
    _offset: offset,
  });
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
  return (data ?? []) as SongActivityRow[];
};

// --- Per-song notification preferences ---

export const getNotificationPrefs = async (song_id: string) => {
  const { data, error } = await supabase
    .from("song_notification_prefs")
    .select("*")
    .eq("song_id", song_id)
    .maybeSingle();
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
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
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
  return data as SongNotificationPrefs | null;
};

// --- Catalog + Workspace reads -------------------------------------------

/** Catalog: all songs the signed-in user is a member of, newest activity first. */
export const listMySongs = async (): Promise<SongCard[]> => {
  const { data, error } = await supabase.rpc("list_my_songs");
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
  return (data ?? []) as SongCard[];
};

/** Workspace hub: full song + counts, or null when caller isn't a member. */
export const getSong = async (song_id: string): Promise<SongDetail | null> => {
  const { data, error } = await supabase
    .rpc("get_song_detail", { _song_id: song_id })
    .maybeSingle();
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
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
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
};
