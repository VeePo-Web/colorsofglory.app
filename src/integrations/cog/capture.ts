import { supabase } from "@/integrations/supabase/client";
import { CogError, call, toCogError } from "./errors";

export type QuickCaptureInput = {
  song_id?: string | null;
  title?: string;
  lyric_snippet?: string;
  scripture_ref?: string;
  tags?: string[];
  section_id?: string | null;
  voice_memo_id?: string | null;
  /**
   * Device-generated stable id for this idea (e.g. `crypto.randomUUID()`),
   * created ONCE when the user commits the idea and reused for every retry.
   * With it, saving is idempotent: a double tap, a flaky network retry, or an
   * outbox replay after reconnect all resolve to the same single capture.
   */
  client_key?: string;
};

export type IdeaCapture = {
  id: string;
  song_id: string | null;
  author_user_id: string;
  title: string | null;
  lyric_snippet: string | null;
  scripture_ref: string | null;
  tags: string[];
  section_id: string | null;
  voice_memo_id: string | null;
  created_at: string;
  updated_at: string;
  promoted_card_id?: string | null;
};

/**
 * Atomically save a quick-capture entry; bumps song last_activity_at when
 * scoped to a song. Pass `client_key` (strongly recommended) to make the save
 * retry-safe — see `QuickCaptureInput.client_key`.
 */
export async function quickCapture(input: QuickCaptureInput): Promise<string> {
  if (input.client_key) {
    const { data, error } = await (supabase as any).rpc("quick_capture_idempotent", {
      _client_key: input.client_key,
      _song_id: input.song_id ?? null,
      _title: input.title ?? "",
      _lyric_snippet: input.lyric_snippet ?? "",
      _scripture_ref: input.scripture_ref ?? "",
      _tags: input.tags ?? [],
      _section_id: input.section_id ?? null,
      _voice_memo_id: input.voice_memo_id ?? null,
    });
    if (error) throw toCogError(error);
    return (data as { id: string }).id;
  }
  const { data, error } = await supabase.rpc("quick_capture", {
    _song_id: input.song_id ?? null,
    _title: input.title ?? "",
    _lyric_snippet: input.lyric_snippet ?? "",
    _scripture_ref: input.scripture_ref ?? "",
    _tags: input.tags ?? [],
    _section_id: input.section_id ?? null,
    _voice_memo_id: input.voice_memo_id ?? null,
  });
  if (error) throw toCogError(error);
  return data as string;
}

export async function listCaptures(song_id: string): Promise<IdeaCapture[]> {
  const { data, error } = await supabase
    .from("idea_captures")
    .select("*")
    .eq("song_id", song_id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw toCogError(error);
  return (data ?? []) as IdeaCapture[];
}

export async function listMyUnfiledCaptures(): Promise<IdeaCapture[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("idea_captures")
    .select("*")
    .is("song_id", null)
    .is("archived_at", null)
    .eq("author_user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw toCogError(error);
  return (data ?? []) as IdeaCapture[];
}

/**
 * Archive an idea (soft). Nothing is destroyed — `restoreCapture` brings it
 * back, and song-scoped archives are recorded in the song's activity feed.
 */
export async function deleteCapture(id: string): Promise<void> {
  const { error } = await (supabase as any).rpc("set_capture_archived", {
    _capture_id: id,
    _archived: true,
  });
  if (error) throw toCogError(error);
}

export const archiveCapture = deleteCapture;

export async function restoreCapture(id: string): Promise<void> {
  const { error } = await (supabase as any).rpc("set_capture_archived", {
    _capture_id: id,
    _archived: false,
  });
  if (error) throw toCogError(error);
}

/** Move an unfiled idea into a song (and optionally a section). */
export async function fileCaptureIntoSong(
  capture_id: string,
  song_id: string,
  section_id?: string | null,
): Promise<void> {
  const { error } = await (supabase as any).rpc("file_capture_into_song", {
    _capture_id: capture_id,
    _song_id: song_id,
    _section_id: section_id ?? null,
  });
  if (error) throw toCogError(error);
}

// ---------- Idea inbox (R21) ----------

export type InboxCapture = IdeaCapture & {
  author_name: string;
  memo_duration_ms: number | null;
};

export type CaptureInbox = {
  unfiled: InboxCapture[];
  song: InboxCapture[];
  unfiled_count: number;
  server_time: string;
};

/**
 * One request for the whole idea inbox: my unfiled ideas plus (optionally)
 * this song's ideas, each already carrying author name, attached memo length,
 * and whether it has already become a canvas card (`promoted_card_id`).
 */
export async function getCaptureInbox(song_id?: string | null): Promise<CaptureInbox> {
  const { data, error } = await (supabase as any).rpc("capture_inbox", {
    _song_id: song_id ?? null,
  });
  if (error) throw toCogError(error);
  return data as CaptureInbox;
}

export type PromoteCaptureInput = {
  capture_id: string;
  target_song_id?: string;
  target_tree?: "ideas" | "final";
  section_label?: string;
  x?: number;
  y?: number;
};

export type PromoteCaptureResult = {
  card_id: string;
  take_id: string | null;
  transcript_pending: boolean;
  already_promoted: boolean;
};

/** Promote an idea capture into a canvas card (idempotent per capture). */
export async function promoteCapture(input: PromoteCaptureInput): Promise<PromoteCaptureResult> {
  // Routed through `call` so the real server code (forbidden, quota, ...)
  // surfaces as a CogError.code instead of a generic non-2xx string.
  const data = await call<PromoteCaptureResult>("promote-capture", input);
  if (!data) throw new CogError("INTERNAL", "promote-capture returned no data");
  return data;
}