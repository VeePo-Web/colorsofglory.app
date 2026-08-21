import type { PracticeSection, TranscriptLine } from "@/lib/audio/practiceTypes";

/**
 * singItEngine — the pure timeline math of the Practice Room ("Sing it"):
 * the whole song as ONE continuous timeline, every section in order, every
 * voice (base + its layers) placed at its section's offset. The audio hook
 * (useSingItPlayer) schedules against this; the karaoke view reads positions
 * from it. Pure and total so it can be unit-tested without an AudioContext.
 *
 * The grid truth: a section's width on the timeline is its ACTIVE take's
 * base duration (metadata). Layers sound WITH their base inside that window
 * and are hard-stopped at the boundary — a long harmony tail never
 * double-voices the next section.
 */

export interface SingItPart {
  memoId: string;
  label: string;
  sectionIndex: number;
  isBase: boolean;
  /** Seed volume — room-shared layer_gain for layers, 1.0 for bases. */
  seedGain: number;
  /** Seed mute — room-shared layer_muted for layers. */
  seedMuted: boolean;
  /** Server latency offset: start this many ms INTO the part's audio. */
  offsetMs: number;
  /** Who sang it — the mixer row's maker dot. */
  authorId?: string | null;
}

export interface SingItTimelineSection {
  id: string;
  label: string;
  /** Song-timeline start of this section, ms. */
  startMs: number;
  durationMs: number;
  lyrics: string | null;
  transcriptLines: TranscriptLine[] | null;
}

export interface SingItTimeline {
  totalMs: number;
  sections: SingItTimelineSection[];
  parts: SingItPart[];
}

/**
 * Build the song timeline from practice sections (in their given order).
 * Sections with no playable base (no memo, zero duration) are skipped —
 * a hole in the audio is never a wall; the song simply continues.
 */
export function buildSingItTimeline(sections: PracticeSection[]): SingItTimeline {
  const outSections: SingItTimelineSection[] = [];
  const parts: SingItPart[] = [];
  let cursorMs = 0;

  for (const section of sections) {
    // The active take: the section's mirror fields always reflect it; the
    // takes array (when present) carries the layers.
    const take = section.takes?.[section.activeTakeIndex ?? 0];
    const memoId = take?.memoId ?? section.memoId;
    const durationMs = take?.durationMs ?? section.durationMs;
    if (!memoId || !Number.isFinite(durationMs) || durationMs <= 0) continue;

    const sectionIndex = outSections.length;
    outSections.push({
      id: section.id,
      label: section.label,
      startMs: cursorMs,
      durationMs,
      lyrics: take?.lyrics ?? section.lyrics,
      transcriptLines: take?.transcriptLines ?? section.transcriptLines,
    });

    parts.push({
      memoId,
      label: take?.label ?? section.label,
      sectionIndex,
      isBase: true,
      seedGain: 1,
      seedMuted: false,
      offsetMs: 0,
      authorId: take?.authorId ?? null,
    });
    for (const layer of take?.layers ?? []) {
      parts.push({
        memoId: layer.memoId,
        label: layer.label,
        sectionIndex,
        isBase: false,
        seedGain: layer.gain,
        seedMuted: layer.muted,
        offsetMs: layer.offsetMs,
        authorId: layer.authorId ?? null,
      });
    }

    cursorMs += durationMs;
  }

  return { totalMs: cursorMs, sections: outSections, parts };
}

/** The section under a song position — clamped, total (never -1 on a non-empty timeline). */
export function sectionIndexAtMs(timeline: SingItTimeline, ms: number): number {
  const { sections } = timeline;
  if (sections.length === 0) return 0;
  if (ms <= 0) return 0;
  for (let i = sections.length - 1; i >= 0; i--) {
    if (ms >= sections[i].startMs) return i;
  }
  return 0;
}

/**
 * Where a part sits when playback starts from `fromMs`:
 *  - null → this part's window is already over (skip it);
 *  - otherwise `{ delayMs, intoPartMs, playMs }`:
 *      delayMs    — wait this long after the shared start tick;
 *      intoPartMs — begin this far into the part's audio (latency offset
 *                   plus any distance already travelled into its section);
 *      playMs     — hard-stop after this long (the section boundary).
 * Pure so the scheduling math is testable without an AudioContext.
 */
export function partWindowFrom(
  timeline: SingItTimeline,
  part: SingItPart,
  fromMs: number,
  /** Device-measured alignment (alignmentStore); merged max() with the
   *  server offset — they are the SAME measurement seen from two stores. */
  deviceOffsetMs = 0,
): { delayMs: number; intoPartMs: number; playMs: number } | null {
  const sec = timeline.sections[part.sectionIndex];
  if (!sec) return null;
  const secEndMs = sec.startMs + sec.durationMs;
  if (fromMs >= secEndMs) return null;

  const latencyMs = Math.max(0, Math.max(part.offsetMs, deviceOffsetMs));
  const delayMs = Math.max(0, sec.startMs - fromMs);
  const travelledMs = Math.max(0, fromMs - sec.startMs);
  return {
    delayMs,
    intoPartMs: latencyMs + travelledMs,
    playMs: secEndMs - Math.max(fromMs, sec.startMs),
  };
}
