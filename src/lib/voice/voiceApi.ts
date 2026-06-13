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
  section_label: string | null;
  storage_path: string;
  created_at: string;
  created_by: string;
  is_processing: boolean;
  status?: VoiceMemoRow["status"];
}

const PROCESSING_STATUSES = new Set<VoiceMemoRow["status"]>([
  "uploading",
  "uploaded",
]);

function toVoiceMemoRecord(row: VoiceMemoRow): VoiceMemoRecord {
  return {
    id: row.id,
    song_id: row.song_id,
    title: row.title ?? "Voice memo",
    duration_ms: row.duration_ms ?? 0,
    section_label: row.section_id ? "Linked section" : "Raw idea",
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
}): Promise<UploadUrlResult> {
  const { data, error } = await supabase.functions.invoke("voice-memo-upload-url", {
    body: {
      song_id: params.songId,
      mime_type: params.mimeType,
      byte_size: params.byteSize,
      duration_ms: params.durationMs,
      file_name: params.fileName,
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
}): Promise<void> {
  const { error } = await supabase.functions.invoke("voice-memo-finalize", {
    body: {
      memo_id: params.memoId,
      actual_byte_size: params.byteSize,
      duration_ms: params.durationMs,
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
    .select("*")
    .eq("song_id", songId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toVoiceMemoRecord);
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
}): Promise<string> {
  const byteSize = params.blob.size;

  const { uploadUrl, memoId } = await getUploadUrl({
    songId: params.songId,
    mimeType: params.mimeType,
    byteSize,
    durationMs: params.durationMs,
    fileName: params.fileName,
  });

  await uploadBlob(uploadUrl, params.blob, params.mimeType);

  await finalizeMemo({
    memoId,
    byteSize,
    durationMs: params.durationMs,
  });

  return memoId;
}
