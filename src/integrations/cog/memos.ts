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
  /** Base memo this take layers over ("Record over this"). */
  parentMemoId?: string;
  /** Stable per-attempt key so a double-tapped save never creates two memos. */
  idempotencyKey?: string;
  /** Original file name when importing existing audio. */
  fileName?: string;
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
    parent_memo_id: input.parentMemoId,
    idempotency_key: input.idempotencyKey,
    file_name: input.fileName,
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

/**
 * Signed playback URL variant that tolerates the edge function's `signed_url`
 * response field (the shape the in-song player pipeline reads). Kept alongside
 * `getPlaybackUrl` so the voice/voiceApi shim can route through the seam
 * without changing which field it consumes.
 */
export async function getSignedPlaybackUrl(memoId: string): Promise<string> {
  const data = await call<{ signed_url?: string; signedUrl?: string; url?: string }>(
    "voice-memo-signed-url",
    { memo_id: memoId },
  );
  return data.signed_url ?? data.signedUrl ?? data.url ?? "";
}

/** Trigger Whisper transcription on an already-uploaded memo. */
export async function transcribeMemo(memoId: string): Promise<void> {
  await call<unknown>("voice-memo-transcribe", { memo_id: memoId });
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped embed, rows re-shaped below
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
  // Routed through the edge function so the storage object is removed too, not
  // just the row (matches `songs.deleteVoiceMemo`).
  await call<{ ok: true }>("voice-memo-delete", { memo_id: memoId });
}

/** Row shape when the memo list embeds its linked section (for the real name). */
export type VoiceMemoWithSection = VoiceMemo & {
  song_sections?: { label: string | null } | null;
};

/**
 * List every memo for a song with its linked section label embedded. Unlike
 * `listMemosForSong` this does NOT filter out `deleted` rows — it mirrors the
 * in-song voiceApi list exactly (the shim maps rows to its display record).
 */
export async function listMemoRowsWithSection(songId: string): Promise<VoiceMemoWithSection[]> {
  const { data, error } = await supabase
    .from("voice_memos")
    .select("*, song_sections(label)")
    .eq("song_id", songId)
    .order("created_at", { ascending: false });
  if (error) throw toCogError(error);
  return (data ?? []) as VoiceMemoWithSection[];
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
 * THE single upload core (A3 · Step 7 "three uploaders → one").
 *
 * Every memo-save in the app converges here: signed URL → PUT → finalize. The
 * in-song pipeline (`lib/voice/voiceApi.uploadVoiceMemo`) now DELEGATES to this
 * function rather than re-implementing the three steps, and the brainstorm
 * outbox uploader already called it — so there is exactly one place that puts a
 * take on the wire. Callers do NOT invoke this directly from the UI: every take
 * routes through `saveMemoDurable` → the Capture Outbox → a registered uploader
 * → this core, so a dropped connection or a QUOTA_EXCEEDED_STORAGE keeps the
 * take safe and retryable ("Saved · will sync").
 *
 * Returns the memo id once the row is finalized.
 */
export async function uploadVoiceMemo(opts: {
  songId: string;
  sectionId?: string | null;
  blob: Blob;
  mimeType?: string;
  durationMs?: number;
  title?: string;
  waveformPeaks?: number[];
  /** Base memo this take layers over ("Record over this", F16). */
  parentMemoId?: string;
  /** Stable per-attempt key so a retried take never double-creates a memo. */
  idempotencyKey?: string;
  /** Original file name when importing existing audio. */
  fileName?: string;
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
    parentMemoId: opts.parentMemoId,
    idempotencyKey: opts.idempotencyKey,
    fileName: opts.fileName,
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