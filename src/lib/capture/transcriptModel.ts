/**
 * Shared types for the Capture Scene transcript pipeline.
 * Pure data — no React, no Supabase. Safe to import from workers/tests.
 */

export type SectionKind =
  | "intro"
  | "verse"
  | "pre-chorus"
  | "chorus"
  | "bridge"
  | "tag"
  | "outro"
  | "interlude"
  | "hook"
  | "unlabeled";

export interface TranscriptWord {
  /** Word text as transcribed. */
  text: string;
  /** Start offset in ms relative to take start. */
  startMs: number;
  /** End offset in ms relative to take start. */
  endMs: number;
}

export interface SectionMarker {
  /** ms offset where this section begins. */
  atMs: number;
  /** Resolved section kind (e.g. "chorus"). */
  kind: SectionKind;
  /** Numeric ordinal when applicable (verse 1 → 1). */
  ordinal?: number;
  /** "voice" = detected via spoken keyword. "manual" = chip tap. */
  source: "voice" | "manual";
  /** Display label, user-editable in the Review sheet. */
  label: string;
}

export interface TranscriptBlock {
  id: string;
  marker: SectionMarker;
  /** Words belonging to this block (after the marker, before the next). */
  words: TranscriptWord[];
  /** Plain-text join of `words` for quick rendering. */
  text: string;
}

export interface CapturePin {
  id: string;
  atMs: number;
  kind: "lyric" | "chord" | "scripture" | "note";
  body: string;
}

export interface CaptureTake {
  /** Local id while in-flight; replaced by server id after upload. */
  localId: string;
  memoId?: string;
  songId: string | null;
  durationMs: number;
  /** Phase 1: populated after batch transcription. Phase 2: streams live. */
  words: TranscriptWord[];
  blocks: TranscriptBlock[];
  pins: CapturePin[];
  createdAt: string;
}