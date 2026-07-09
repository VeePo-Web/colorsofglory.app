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
  /**
   * ms offset where this section's *content* begins — i.e. the end of the
   * spoken marker phrase ("verse one") plus any leading fillers
   * ("okay", "this is the…"). `buildTranscriptBlocks` uses this to strip
   * the announcement out of the card body so the user only sees the actual
   * lyric. When unset, falls back to `atMs`.
   */
  contentStartMs?: number;
  /** Resolved section kind (e.g. "chorus"). */
  kind: SectionKind;
  /** Numeric ordinal when applicable (verse 1 → 1). */
  ordinal?: number;
  /**
   * Letter variant when spoken (verse 1a → "A", chorus 2b → "B"). Lets a
   * songwriter sketch alternates of the same section ("verse 1a" vs "verse 1b")
   * by voice. Always upper-cased. Appended to the ordinal in the label
   * ("Verse 1A").
   */
  variant?: string;
  /** "voice" = detected via spoken keyword. "manual" = chip tap. */
  source: "voice" | "manual";
  /** Display label, user-editable in the Review sheet. */
  label: string;
  /**
   * 0..1 likelihood that this voice marker was an ANNOUNCEMENT ("…[pause]
   * verse two") rather than the word sung as a lyric ("every verse of this
   * psalm"). Derived from word-timestamp pauses and phrasing — the Dragon
   * NaturallySpeaking command-vs-content lesson. Markers below the apply
   * threshold are NEVER used to split silently; they surface in review for
   * one-tap confirmation. Unset (manual chips, server blocks) means 1.
   */
  confidence?: number;
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