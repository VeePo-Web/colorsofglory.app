// Voice memo / take / transcript domain types.
//
// PROVENANCE:
//   VoiceMemo            — 1:1 ROW ALIAS of public.voice_memos.
//   VoiceMemoTranscript  — 1:1 ROW ALIAS of public.voice_memo_transcripts.
//   Take                 — read shape of public.takes (per-memo layered
//                          "record over this" recording); hand-modeled, not a
//                          Tables<> alias because callers read a curated subset.
//   TranscriptBlock / TranscriptPayload / TakeTranscriptRow — COMPOSED take-level
//                          structured-transcript shapes (transcript_json payload).
// NOTE: a memo-level `TranscriptStatus`
// with a different union also exists in src/integrations/cog/memos.ts; the barrel
// intentionally surfaces only the take-level one below (they are distinct
// concepts that happen to share a name).
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

export type TranscriptBlock = {
  id: string;
  kind: "lyrics" | "chords" | "scripture" | "idea" | "section";
  section_kind: string | null;
  label: string;
  text: string;
  start_ms: number;
  end_ms: number;
};

export type TranscriptPayload = {
  model: string;
  blocks: TranscriptBlock[];
  raw_text: string;
};

/** Take-level transcription status (distinct from the memo-level union). */
export type TranscriptStatus = "idle" | "processing" | "ready" | "failed";

export type TakeTranscriptRow = {
  id: string;
  song_id: string;
  storage_path: string;
  duration_ms: number | null;
  transcript_status: TranscriptStatus;
  transcript_json: TranscriptPayload | null;
  transcript_error: string | null;
};
