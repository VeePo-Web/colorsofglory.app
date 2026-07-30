import { supabase } from "@/integrations/supabase/client";
import { CogError, toCogError } from "./errors";

export type Take = {
  id: string;
  voice_memo_id: string;
  song_id: string;
  created_by: string;
  storage_path: string;
  duration_ms: number | null;
  byte_size: number;
  waveform_peaks: number[] | null;
  friendly_name: string | null;
  name_is_custom: boolean;
  is_primary: boolean;
  is_archived: boolean;
  created_at: string;
};

export async function listTakes(
  voice_memo_id: string,
  opts: { include_archived?: boolean } = {},
): Promise<Take[]> {
  const { data, error } = await supabase.rpc("list_takes", {
    _voice_memo_id: voice_memo_id,
    _include_archived: opts.include_archived ?? false,
  });
  if (error) throw toCogError(error);
  return (data ?? []) as Take[];
}

export async function setPrimaryTake(take_id: string): Promise<string> {
  const { data, error } = await supabase.rpc("set_primary_take", { _take_id: take_id });
  if (error) throw toCogError(error);
  return data as string;
}

export async function archiveTake(take_id: string): Promise<void> {
  const { error } = await supabase
    .from("takes")
    .update({ is_archived: true })
    .eq("id", take_id);
  if (error) throw toCogError(error);
}

export async function unarchiveTake(take_id: string): Promise<void> {
  const { error } = await supabase
    .from("takes")
    .update({ is_archived: false })
    .eq("id", take_id);
  if (error) throw toCogError(error);
}

export async function renameTake(take_id: string, friendly_name: string): Promise<void> {
  const { error } = await supabase
    .from("takes")
    .update({ friendly_name, name_is_custom: true })
    .eq("id", take_id);
  if (error) throw toCogError(error);
}

/**
 * Create a new take for an existing voice memo.
 * Caller must have already uploaded the audio to the `voice-memos` bucket
 * at the path returned by `buildTakeStoragePath` (or any path they own).
 */
export async function createTake(input: {
  voice_memo_id: string;
  song_id: string;
  storage_path: string;
  mime_type?: string;
  duration_ms?: number;
  byte_size?: number;
  waveform_peaks?: number[] | null;
  make_primary?: boolean;
}): Promise<Take> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new CogError("UNAUTHENTICATED", "Not authenticated");

  const { data, error } = await supabase
    .from("takes")
    .insert({
      voice_memo_id: input.voice_memo_id,
      song_id: input.song_id,
      created_by: uid,
      storage_path: input.storage_path,
      mime_type: input.mime_type ?? "audio/webm",
      duration_ms: input.duration_ms ?? null,
      byte_size: input.byte_size ?? 0,
      waveform_peaks: (input.waveform_peaks ?? null) as never,
      is_primary: false,
    })
    .select("*")
    .single();
  if (error) throw toCogError(error);
  if (input.make_primary) {
    await setPrimaryTake(data.id);
  }
  return data as Take;
}

export function buildTakeStoragePath(song_id: string, user_id: string, take_id: string, ext = "webm") {
  return `${song_id}/${user_id}/takes/${take_id}.${ext}`;
}

export async function getTakeSignedUrl(storage_path: string, expires_in_seconds = 60 * 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from("voice-memos")
    .createSignedUrl(storage_path, expires_in_seconds);
  if (error) throw toCogError(error);
  return data.signedUrl;
}
// ---------- Pending background work (R12) ----------

export type PendingWorkItem = {
  take_id: string;
  voice_memo_id: string;
  friendly_name: string | null;
  duration_ms: number | null;
  status: "pending" | "processing" | "failed" | string;
  error: string | null;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  can_retry: boolean;
  waveform_pending: boolean;
  created_at: string;
};

export type PendingWork = { items: PendingWorkItem[]; server_time: string };

/**
 * Everything in this song that is still being worked on in the background —
 * transcripts queued/running/failed, waveforms not yet computed. Use it to
 * render truthful per-take states instead of a permanent shimmer.
 * Poll sparingly (on mount, on realtime take events, on tab refocus).
 */
export async function getSongPendingWork(song_id: string): Promise<PendingWork> {
  const { data, error } = await (supabase as any).rpc("song_pending_work", {
    _song_id: song_id,
  });
  if (error) throw toCogError(error);
  return data as PendingWork;
}

/**
 * Requeue a failed transcript immediately, resetting the attempt counter.
 * Requires edit rights on the song. The audio is never at risk — this only
 * affects the derived transcript.
 */
export async function retryTakeTranscript(take_id: string): Promise<void> {
  const { error } = await (supabase as any).rpc("retry_take_transcript", {
    _take_id: take_id,
  });
  if (error) throw toCogError(error);
}
