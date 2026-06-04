import { supabase } from "@/integrations/supabase/client";

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

async function call<T = unknown>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  const env = data as Envelope<T> | undefined;
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
}) => call<{ song: any }>("create-song", input);

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
}) => call<{ invite: any }>("song-invite-create", input);

export const acceptInvite = (token: string) =>
  call<{ song_id: string; role: string; already_member: boolean }>(
    "song-invite-accept",
    { token },
  );

export type InvitePreview = {
  song_id: string;
  song_title: string;
  inviter_name: string;
  role: string;
  collaborator_count: number;
  expires_at: string;
  uses_remaining: number;
};

export const previewInvite = (token: string) =>
  call<InvitePreview>("song-invite-preview", { token });
