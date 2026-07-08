import {
  getSignedPlaybackUrl,
  deleteMemo as deleteMemoSeam,
  transcribeMemo as transcribeMemoSeam,
  uploadVoiceMemo as uploadVoiceMemoCore,
  listMemoRowsWithSection,
  type VoiceMemo,
  type VoiceMemoWithSection,
} from "@/integrations/cog/memos";

// ─── In-song voice pipeline (shim) ──────────────────────────────────────────
// Every backend call routes through the cog/memos seam — this module no longer
// touches the Supabase client directly. It keeps the richer, display-oriented
// `VoiceMemoRecord` shape (resolved section label + peak fallback) that the
// in-song voice UI reads, mapping seam rows into it.

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
   * never written to the DB — the server uses the narrower `VoiceMemo` union.
   */
  status?: VoiceMemo["status"] | "queued";
}

const PROCESSING_STATUSES = new Set<VoiceMemo["status"]>([
  "uploading",
  "uploaded",
]);

function toVoiceMemoRecord(row: VoiceMemoWithSection): VoiceMemoRecord {
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

// The signed-URL → PUT → finalize steps were removed in A3 · Step 7's "three
// uploaders → one" collapse: `uploadVoiceMemo` (below) now delegates to the
// single upload core in `cog/memos`, so there is exactly one PUT-and-finalize
// implementation in the tree. No surface imported these step helpers directly.

/** Get a time-limited signed URL for playback */
export async function getSignedUrl(memoId: string): Promise<string> {
  return getSignedPlaybackUrl(memoId);
}

/** Delete a voice memo and its storage file */
export async function deleteMemo(memoId: string): Promise<void> {
  await deleteMemoSeam(memoId);
}

/** Trigger Whisper transcription on an already-uploaded memo */
export async function transcribeMemo(memoId: string): Promise<void> {
  await transcribeMemoSeam(memoId);
}

/** Fetch all voice memos for a song from the DB */
export async function listVoiceMemos(songId: string): Promise<VoiceMemoRecord[]> {
  const rows = await listMemoRowsWithSection(songId);
  return rows.map(toVoiceMemoRecord);
}

/**
 * Complete in-song upload — signed URL → PUT → finalize.
 *
 * DELEGATES to the single upload core in `cog/memos` (A3 · Step 7 "three
 * uploaders → one"): this is no longer a parallel re-implementation of the three
 * steps, it maps the in-song params (section id, layer parent, real peaks) onto
 * the one seam function that every pipeline shares. `sectionLabel` / `transcribe`
 * are display / server-triggered concerns and are intentionally not forwarded —
 * the section is carried by the real `sectionId`, and finalize triggers
 * transcription server-side.
 */
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
  return uploadVoiceMemoCore({
    songId: params.songId,
    sectionId: params.sectionId ?? null,
    blob: params.blob,
    mimeType: params.mimeType,
    durationMs: params.durationMs,
    title: params.title,
    waveformPeaks: params.waveformPeaks ?? undefined,
    parentMemoId: params.parentMemoId,
    idempotencyKey: params.idempotencyKey,
    fileName: params.fileName,
  });
}
