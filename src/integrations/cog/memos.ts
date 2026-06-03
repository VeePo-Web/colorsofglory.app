import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type VoiceMemo = Database["public"]["Tables"]["voice_memos"]["Row"];
export type VoiceMemoTranscript = Database["public"]["Tables"]["voice_memo_transcripts"]["Row"];

/** Lifecycle stages for a voice memo. `ready` is legacy — new rows use the others. */
export type MemoLifecycle =
  | "uploading"
  | "uploaded"
  | "finalized"
  | "transcribed"
  | "failed"
  | "deleted"
  | "ready";

export type TranscriptStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "skipped";

export interface CreateUploadUrlInput {
  songId: string;
  sectionId?: string | null;
  mimeType: string;
  byteSize: number;
  durationMs?: number;
  title?: string;
}

export interface CreateUploadUrlResult {
  memo_id: string;
  storage_path: string;
  upload_url: string;
  token: string;
}

export async function createUploadUrl(input: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
  const { data, error } = await supabase.functions.invoke("voice-memo-upload-url", {
    body: {
      song_id: input.songId,
      section_id: input.sectionId ?? null,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      duration_ms: input.durationMs,
      title: input.title,
    },
  });
  if (error) throw error;
  return data as CreateUploadUrlResult;
}

export interface FinalizeUploadInput {
  memoId: string;
  actualByteSize?: number;
  durationMs?: number;
  waveformPeaks?: number[];
}

export async function finalizeUpload(input: FinalizeUploadInput) {
  const { data, error } = await supabase.functions.invoke("voice-memo-finalize", {
    body: {
      memo_id: input.memoId,
      actual_byte_size: input.actualByteSize,
      duration_ms: input.durationMs,
      waveform_peaks: input.waveformPeaks,
    },
  });
  if (error) throw error;
  return data as { memo_id: string; status: string; byte_size: number };
}

export async function getPlaybackUrl(memoId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("voice-memo-signed-url", {
    body: { memo_id: memoId },
  });
  if (error) throw error;
  return (data as { url: string }).url;
}

export async function listMemosForSong(songId: string): Promise<VoiceMemo[]> {
  const { data, error } = await supabase
    .from("voice_memos")
    .select("*")
    .eq("song_id", songId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listMemosForSection(sectionId: string): Promise<VoiceMemo[]> {
  const { data, error } = await supabase
    .from("voice_memos")
    .select("*")
    .eq("section_id", sectionId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTranscript(memoId: string): Promise<VoiceMemoTranscript | null> {
  const { data, error } = await supabase
    .from("voice_memo_transcripts")
    .select("*")
    .eq("memo_id", memoId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteMemo(memoId: string): Promise<void> {
  const { error } = await supabase.from("voice_memos").delete().eq("id", memoId);
  if (error) throw error;
}

/** Reset attempt count and re-queue transcription for a failed memo. */
export async function retryTranscription(memoId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("voice-memo-retranscribe", {
    body: { memo_id: memoId },
  });
  if (error) throw error;
}

export function subscribeMemos(
  songId: string,
  onChange: (payload: { event: string; memo?: VoiceMemo }) => void,
) {
  const channel = supabase
    .channel(`voice_memos:${songId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "voice_memos", filter: `song_id=eq.${songId}` },
      (payload) => {
        onChange({
          event: payload.eventType,
          memo: (payload.new as VoiceMemo) ?? (payload.old as VoiceMemo),
        });
      },
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "voice_memo_transcripts", filter: `song_id=eq.${songId}` },
      (payload) => {
        onChange({ event: `transcript:${payload.eventType}` });
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * High-level helper: uploads a Blob and finalizes the memo.
 * Returns the memo id once ready.
 */
export async function uploadVoiceMemo(opts: {
  songId: string;
  sectionId?: string | null;
  blob: Blob;
  mimeType?: string;
  durationMs?: number;
  title?: string;
  waveformPeaks?: number[];
}): Promise<string> {
  const mimeType = opts.mimeType ?? opts.blob.type ?? "audio/webm";
  const byteSize = opts.blob.size;

  const { memo_id, upload_url, token } = await createUploadUrl({
    songId: opts.songId,
    sectionId: opts.sectionId ?? null,
    mimeType,
    byteSize,
    durationMs: opts.durationMs,
    title: opts.title,
  });

  // Use signed-upload PUT
  const putResp = await fetch(upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "x-upsert": "true",
      Authorization: `Bearer ${token}`,
    },
    body: opts.blob,
  });
  if (!putResp.ok) {
    const errText = await putResp.text();
    throw new Error(`Upload failed: ${putResp.status} ${errText}`);
  }

  await finalizeUpload({
    memoId: memo_id,
    actualByteSize: byteSize,
    durationMs: opts.durationMs,
    waveformPeaks: opts.waveformPeaks,
  });

  return memo_id;
}