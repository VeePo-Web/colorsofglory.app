import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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

/**
 * Canonical edge-function error codes. UI can switch on these to render
 * specific messages without parsing free-text error strings.
 */
export type CogErrorCode =
  | "INTERNAL"
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "METHOD_NOT_ALLOWED"
  | "QUOTA_EXCEEDED_SONGS"
  | "QUOTA_EXCEEDED_STORAGE"
  | "SONG_NOT_FOUND"
  | "SONG_DELETED"
  | "NOT_A_MEMBER"
  | "OWNER_CANNOT_LEAVE"
  | "NEW_OWNER_NOT_MEMBER"
  | "TRANSFER_BLOCKED_QUOTA"
  | "INVITE_NOT_FOUND"
  | "INVITE_EXPIRED"
  | "INVITE_ALREADY_USED"
  | "INVITE_EXHAUSTED";

export class CogError extends Error {
  code: CogErrorCode | string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

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
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
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
