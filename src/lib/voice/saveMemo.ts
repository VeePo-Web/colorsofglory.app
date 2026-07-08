import { enqueueCaptureUpload } from "./captureOutbox";
import { computeWaveformPeaks } from "@/lib/audio/waveformPeaks";
import type { VoiceMemoRecord } from "./voiceApi";

/**
 * saveMemoDurable — THE canonical save for every C4 voice surface.
 *
 * One path, no exceptions: recorder blob (or imported file) → real peaks are
 * computed once → cache-first captureOutbox.enqueueCaptureUpload → the voiceApi
 * pipeline (signed URL → PUT → finalize with peaks + section id) → the outbox
 * subscription reconciles the optimistic card when the take syncs.
 *
 * From the moment this resolves, the take cannot be lost — not offline, not by
 * a killed tab, not by a failed upload. Do NOT call uploadVoiceMemo /
 * submitSharedAudio directly from a surface; that bypasses the guarantee.
 */
export interface SaveMemoParams {
  blob: Blob;
  songId: string;
  title: string;
  mimeType: string;
  durationMs: number;
  /** Display grouping label ("Verse 1", "Raw idea", …). */
  sectionLabel: string;
  /** Real lyric section id when attaching to a section (PV-05). */
  sectionId?: string | null;
  transcribe?: boolean;
  /** Base memo id when this is a layer ("Record over this", F16). */
  parentMemoId?: string;
  fileName?: string;
  createdBy?: string;
}

export interface SaveMemoResult {
  outboxId: string;
  /** Optimistic card, keyed to the durable outbox id, with real peaks already. */
  optimistic: VoiceMemoRecord;
}

export async function saveMemoDurable(params: SaveMemoParams): Promise<SaveMemoResult> {
  // Compute-once real peaks. A decode failure yields null (legacy-style card),
  // never a blocked save — the audio itself is what must survive.
  const peaks = await computeWaveformPeaks(params.blob);

  const { outboxId } = await enqueueCaptureUpload({
    blob: params.blob,
    songId: params.songId,
    title: params.title,
    mimeType: params.mimeType,
    durationMs: params.durationMs,
    sectionLabel: params.sectionLabel,
    transcribe: params.transcribe,
    parentMemoId: params.parentMemoId,
    fileName: params.fileName,
    extra: {
      sectionId: params.sectionId ?? null,
      waveformPeaks: peaks ?? undefined,
    },
  });

  const optimistic: VoiceMemoRecord = {
    id: outboxId,
    song_id: params.songId,
    title: params.title,
    duration_ms: params.durationMs,
    section_id: params.sectionId ?? null,
    section_label: params.sectionLabel,
    waveform_peaks: peaks,
    storage_path: "",
    created_at: new Date().toISOString(),
    created_by: params.createdBy ?? "You",
    is_processing: true,
    status: "uploading",
  };

  return { outboxId, optimistic };
}
