import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CogError, call, toCogError } from "./errors";

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
  // Routed through `call` so a QUOTA_EXCEEDED_STORAGE surfaces as a CogError.code
  // — the storage-quota gate for every take.
  return call<CreateUploadUrlResult>("voice-memo-upload-url", {
    song_id: input.songId,
    section_id: input.sectionId ?? null,
    mime_type: input.mimeType,
    byte_size: input.byteSize,
    duration_ms: input.durationMs,
    title: input.title,
  });
}

export interface FinalizeUploadInput {
  memoId: string;
  actualByteSize?: number;
  durationMs?: number;
  waveformPeaks?: number[];
}

export async function finalizeUpload(input: FinalizeUploadInput) {
  return call<{ memo_id: string; status: string; byte_size: number }>("voice-memo-finalize", {
    memo_id: input.memoId,
    actual_byte_size: input.actualByteSize,
    duration_ms: input.durationMs,
    waveform_peaks: input.waveformPeaks,
  });
}

export async function getPlaybackUrl(memoId: string): Promise<string> {
  const data = await call<{ url: string }>("voice-memo-signed-url", { memo_id: memoId });
  return data.url;
}

export async function listMemosForSong(songId: string): Promise<VoiceMemo[]> {
  const { data, error } = await supabase
    .from("voice_memos")
    .select("*")
    .eq("song_id", songId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  if (error) throw toCogError(error);
  return data ?? [];
}

export async function listMemosForSection(sectionId: string): Promise<VoiceMemo[]> {
  const { data, error } = await supabase
    .from("voice_memos")
    .select("*")
    .eq("section_id", sectionId)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  if (error) throw toCogError(error);
  return data ?? [];
}

/** Row shape for the capture scene's "Latest" peek strip. */
export interface RecentCaptureMemo {
  memo_id: string;
  song_id: string;
  song_title: string;
  title: string | null;
  duration_ms: number | null;
  /** Transcript blocks on the primary take — the strip's "N sections" hint. */
  section_count: number;
  created_at: string;
}

/**
 * The signed-in user's most recent memos across ALL songs, with the song title
 * and primary-take block count embedded so the peek strip renders without
 * follow-up queries. Added for C2's Step-9 eviction of the strip's raw query;
 * A3 owns the shape. Returns [] when signed out.
 */
export async function listMyRecentMemos(limit = 3): Promise<RecentCaptureMemo[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  // Embedded selects cross tables the generated types lag behind — same local
  // cast pattern as cog/transcript.ts.
  const db = supabase as unknown as { from: (t: string) => any };
  const { data, error } = await db
    .from("voice_memos")
    .select("id, song_id, title, duration_ms, created_at, songs(title), takes(transcript_json)")
    .eq("author_user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw toCogError(error);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return rows.map((row) => {
    const takes = row.takes as Array<{ transcript_json?: { blocks?: unknown[] } | null }> | null;
    const blocks = takes?.[0]?.transcript_json?.blocks ?? [];
    return {
      memo_id: row.id as string,
      song_id: row.song_id as string,
      song_title: (row.songs as { title?: string } | null)?.title ?? "Untitled",
      title: (row.title as string | null) ?? null,
      duration_ms: (row.duration_ms as number | null) ?? null,
      section_count: Array.isArray(blocks) ? blocks.length : 0,
      created_at: row.created_at as string,
    };
  });
}

export async function getTranscript(memoId: string): Promise<VoiceMemoTranscript | null> {
  const { data, error } = await supabase
    .from("voice_memo_transcripts")
    .select("*")
    .eq("memo_id", memoId)
    .maybeSingle();
  if (error) throw toCogError(error);
  return data;
}

export async function deleteMemo(memoId: string): Promise<void> {
  const { error } = await supabase.from("voice_memos").delete().eq("id", memoId);
  if (error) throw toCogError(error);
}

/** Reset attempt count and re-queue transcription for a failed memo. */
export async function retryTranscription(memoId: string): Promise<void> {
  await call<unknown>("voice-memo-retranscribe", { memo_id: memoId });
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
    throw new CogError("INTERNAL", `Upload failed: ${putResp.status} ${errText}`);
  }

  await finalizeUpload({
    memoId: memo_id,
    actualByteSize: byteSize,
    durationMs: opts.durationMs,
    waveformPeaks: opts.waveformPeaks,
  });

  return memo_id;
}