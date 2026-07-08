import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type VoiceMemoRow = Database["public"]["Tables"]["voice_memos"]["Row"];

export interface UploadUrlResult {
  uploadUrl: string;
  memoId: string;
  storagePath: string;
}

export interface VoiceMemoRecord {
  id: string;
  song_id: string;
  title: string;
  duration_ms: number;
  /** Real section id when the memo is attached to a lyric section (PV-05). */
  section_id: string | null;
  /** Resolved section name (e.g. "Verse 1") — never a placeholder string. */
  section_label: string | null;
  /** Persisted real-audio peaks (0–1). Null only on legacy rows → seed fallback. */
  waveform_peaks: number[] | null;
  storage_path: string;
  created_at: string;
  created_by: string;
  is_processing: boolean;
  /**
   * `"queued"` is a client-only optimistic status used while a freshly captured
   * take is held in the Capture Outbox (cached locally, waiting to sync). It is
   * never written to the DB — the server uses the narrower `VoiceMemoRow` union.
   */
  status?: VoiceMemoRow["status"] | "queued";
}

const PROCESSING_STATUSES = new Set<VoiceMemoRow["status"]>([
  "uploading",
  "uploaded",
]);

/** Row shape when the memo list embeds its linked section (for the real name). */
type VoiceMemoRowWithSection = VoiceMemoRow & {
  song_sections?: { label: string | null } | null;
};

function toVoiceMemoRecord(row: VoiceMemoRowWithSection): VoiceMemoRecord {
  return {
    id: row.id,
    song_id: row.song_id,
    title: row.title ?? "Voice memo",
    duration_ms: row.duration_ms ?? 0,
    section_id: row.section_id,
    // Resolve the REAL section name from the embedded row — a memo attached to
    // "Verse 1" reads "Verse 1", never a "Linked section" placeholder.
    section_label: row.section_id
      ? row.song_sections?.label ?? null
      : "Raw idea",
    waveform_peaks: Array.isArray(row.waveform_peaks)
      ? (row.waveform_peaks as number[])
      : null,
    storage_path: row.storage_path,
    created_at: row.created_at,
    created_by: "Contributor",
    is_processing: PROCESSING_STATUSES.has(row.status),
    status: row.status,
  };
}

/** Step 1 of upload: get a signed URL to PUT audio to Supabase Storage */
export async function getUploadUrl(params: {
  songId: string;
  mimeType: string;
  byteSize: number;
  durationMs: number;
  fileName?: string;
  /**
   * When set, this memo is a layer recorded over the given base memo
   * ("Record over this"). The edge function persists it as a child once the
   * `voice_memos.parent_memo_id` column exists; until then it is ignored
   * server-side and the relationship is held on the client.
   */
  parentMemoId?: string;
  /** Dedupes a double-tapped "Save layer" so it never creates two memos. */
  idempotencyKey?: string;
  /** Real lyric section this memo is attached to (PV-05). */
  sectionId?: string | null;
}): Promise<UploadUrlResult> {
  const { data, error } = await supabase.functions.invoke("voice-memo-upload-url", {
    body: {
      song_id: params.songId,
      mime_type: params.mimeType,
      byte_size: params.byteSize,
      duration_ms: params.durationMs,
      file_name: params.fileName,
      parent_memo_id: params.parentMemoId,
      idempotency_key: params.idempotencyKey,
      section_id: params.sectionId ?? null,
    },
  });
  if (error) throw new Error(error.message);
  return {
    uploadUrl: data.upload_url ?? data.uploadUrl,
    memoId: data.memo_id ?? data.memoId,
    storagePath: data.storage_path ?? data.storagePath,
  };
}

/** Step 2 of upload: PUT the blob to Supabase Storage using the signed URL */
export async function uploadBlob(signedUrl: string, blob: Blob, mimeType: string): Promise<void> {
  const res = await fetch(signedUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": mimeType },
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
}

/** Step 3 of upload: finalize — creates the DB record, optionally triggers transcription */
export async function finalizeMemo(params: {
  memoId: string;
  byteSize: number;
  durationMs: number;
  /** Real-audio peaks computed at capture — persisted for every card/player. */
  waveformPeaks?: number[] | null;
}): Promise<void> {
  const { error } = await supabase.functions.invoke("voice-memo-finalize", {
    body: {
      memo_id: params.memoId,
      actual_byte_size: params.byteSize,
      duration_ms: params.durationMs,
      waveform_peaks: params.waveformPeaks ?? undefined,
    },
  });
  if (error) throw new Error(error.message);
}

/** Get a time-limited signed URL for playback */
export async function getSignedUrl(memoId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("voice-memo-signed-url", {
    body: { memo_id: memoId },
  });
  if (error) throw new Error(error.message);
  return data.signed_url ?? data.signedUrl;
}

/** Delete a voice memo and its storage file */
export async function deleteMemo(memoId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("voice-memo-delete", {
    body: { memo_id: memoId },
  });
  if (error) throw new Error(error.message);
}

/** Trigger Whisper transcription on an already-uploaded memo */
export async function transcribeMemo(memoId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("voice-memo-transcribe", {
    body: { memo_id: memoId },
  });
  if (error) throw new Error(error.message);
}

/** Fetch all voice memos for a song from the DB */
export async function listVoiceMemos(songId: string): Promise<VoiceMemoRecord[]> {
  const { data, error } = await supabase
    .from("voice_memos")
    .select("*, song_sections(label)")
    .eq("song_id", songId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as VoiceMemoRowWithSection[]).map(toVoiceMemoRecord);
}

/** Complete upload: getUploadUrl + upload blob + finalize in sequence */
export async function uploadVoiceMemo(params: {
  songId: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  title: string;
  sectionLabel: string;
  transcribe?: boolean;
  fileName?: string;
  /** Base memo this take layers over ("Record over this"). */
  parentMemoId?: string;
  /** Stable key per save attempt; prevents duplicate layers on double-tap. */
  idempotencyKey?: string;
  /** Real lyric section this memo attaches to (PV-05). */
  sectionId?: string | null;
  /** Real-audio peaks computed at capture (waveformPeaks module). */
  waveformPeaks?: number[] | null;
}): Promise<string> {
  const byteSize = params.blob.size;

  const { uploadUrl, memoId } = await getUploadUrl({
    songId: params.songId,
    mimeType: params.mimeType,
    byteSize,
    durationMs: params.durationMs,
    fileName: params.fileName,
    parentMemoId: params.parentMemoId,
    idempotencyKey: params.idempotencyKey,
    sectionId: params.sectionId,
  });

  await uploadBlob(uploadUrl, params.blob, params.mimeType);

  await finalizeMemo({
    memoId,
    byteSize,
    durationMs: params.durationMs,
    waveformPeaks: params.waveformPeaks,
  });

  return memoId;
}
