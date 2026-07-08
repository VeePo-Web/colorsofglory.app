import { supabase } from "@/integrations/supabase/client";
import type { Take } from "@/types";

// `Take` moved to the @/types barrel (A2 Step 3); re-exported for existing deep
// imports until the Step 10 codemod repoints them.
export type { Take };

export async function listTakes(
  voice_memo_id: string,
  opts: { include_archived?: boolean } = {},
): Promise<Take[]> {
  const { data, error } = await supabase.rpc("list_takes", {
    _voice_memo_id: voice_memo_id,
    _include_archived: opts.include_archived ?? false,
  });
  if (error) throw error;
  return (data ?? []) as Take[];
}

export async function setPrimaryTake(take_id: string): Promise<string> {
  const { data, error } = await supabase.rpc("set_primary_take", { _take_id: take_id });
  if (error) throw error;
  return data as string;
}

export async function archiveTake(take_id: string): Promise<void> {
  const { error } = await supabase
    .from("takes")
    .update({ is_archived: true })
    .eq("id", take_id);
  if (error) throw error;
}

export async function unarchiveTake(take_id: string): Promise<void> {
  const { error } = await supabase
    .from("takes")
    .update({ is_archived: false })
    .eq("id", take_id);
  if (error) throw error;
}

export async function renameTake(take_id: string, friendly_name: string): Promise<void> {
  const { error } = await supabase
    .from("takes")
    .update({ friendly_name, name_is_custom: true })
    .eq("id", take_id);
  if (error) throw error;
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
  if (!uid) throw new Error("Not authenticated");

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
  if (error) throw error;
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
  if (error) throw error;
  return data.signedUrl;
}