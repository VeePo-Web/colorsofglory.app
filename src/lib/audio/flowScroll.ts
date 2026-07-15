/**
 * flowScroll — the pure math behind Flow, the hands-free autoscroll perform
 * mode. PRACTICE-domain (owned by F2, same folder-exception as
 * practiceTypes.ts — see docs/PRACTICE-CONTRACT.md).
 *
 * Flow scrolls the WHOLE song (lyrics + chords) at a pace the performer plays
 * live against. The "works every single time" architecture is one unified
 * engine — a monotonic piecewise-linear mapping time → scrollY (keyframes) —
 * fed by whichever tier of data the song has:
 *
 *   Tier 3 (time-synced):    keyframes from transcript-line timestamps
 *                            (each timed line reaches the reading line at its
 *                            real startMs), section boundaries filling gaps.
 *   Tier 2 (duration-paced): keyframes from section blocks × take durations —
 *                            the chart finishes when the song's length does.
 *   Tier 1 (always):         two keyframes — constant velocity from the
 *                            song's tempo_bpm, else a gentle default.
 *
 * The performer's speed nudge is a TIME multiplier applied uniformly across
 * tiers, remembered per song. The inverse mapping (timeAt) is what makes
 * manual drag-scroll seamless: grab, reposition, and the clock re-derives
 * itself from wherever you let go. Honesty rule: never oversell "locked to
 * the beat" — this starts at your tempo, gets smarter with the song's data,
 * and keeps you in control.
 */

export interface FlowKeyframe {
  /** Milliseconds from the start of the performance. */
  tMs: number;
  /** scrollTop the content should sit at, at tMs. */
  y: number;
}

export type FlowTier = 1 | 2 | 3;

export interface FlowPlan {
  tier: FlowTier;
  frames: FlowKeyframe[];
}

// ── Tier 1: tempo → velocity ─────────────────────────────────────────────────

/** Nothing known about the song: a gentle, readable stand pace. */
export const DEFAULT_PIXELS_PER_SECOND = 12;
const MIN_PPS = 6;
const MAX_PPS = 40;

/**
 * Map the song's BPM to a scroll velocity. Model: one sung lyric line spans
 * roughly two bars of 4/4 (8 beats), so a line of height L should take
 * 8·60/bpm seconds → pps = L·bpm/480. It's a starting point, not a promise —
 * the nudge + per-song memory make it exactly right by the second run.
 */
export function bpmToPixelsPerSecond(
  bpm: number | null | undefined,
  lineHeightPx = 60,
): number {
  if (!bpm || !Number.isFinite(bpm) || bpm <= 0) return DEFAULT_PIXELS_PER_SECOND;
  const pps = (lineHeightPx * bpm) / 480;
  return Math.min(MAX_PPS, Math.max(MIN_PPS, pps));
}

// ── Keyframe builders ────────────────────────────────────────────────────────

/** Tier 1: the whole scrollable distance at one constant velocity. */
export function buildConstantKeyframes(maxScroll: number, pixelsPerSecond: number): FlowKeyframe[] {
  const pps = pixelsPerSecond > 0 ? pixelsPerSecond : DEFAULT_PIXELS_PER_SECOND;
  const total = Math.max(0, maxScroll);
  return [
    { tMs: 0, y: 0 },
    { tMs: total > 0 ? (total / pps) * 1000 : 1, y: total },
  ];
}

export interface FlowSectionBlock {
  /** Content offsetTop of the section block, px. */
  top: number;
  height: number;
  /** The section's take duration (0/unknown disqualifies Tier 2/3). */
  durationMs: number;
}

/**
 * Tier 2: each section scrolls past over its own take's duration — the chart
 * finishes when the song does, and wordy-vs-sparse sections pace themselves.
 * Returns null when any section lacks a real duration (fall back a tier).
 */
export function buildSectionKeyframes(
  blocks: FlowSectionBlock[],
  maxScroll: number,
): FlowKeyframe[] | null {
  if (blocks.length === 0 || maxScroll <= 0) return null;
  if (blocks.some((b) => !Number.isFinite(b.durationMs) || b.durationMs <= 0)) return null;
  const frames: FlowKeyframe[] = [{ tMs: 0, y: 0 }];
  let t = 0;
  for (const b of blocks) {
    t += b.durationMs;
    frames.push({ tMs: t, y: Math.min(maxScroll, b.top + b.height) });
  }
  frames[frames.length - 1] = { tMs: t, y: maxScroll };
  return sanitizeFrames(frames, maxScroll);
}

export interface FlowLinePoint {
  /** Absolute performance time this line should reach the reading line. */
  tMs: number;
  /** Target scrollTop for that moment (lineTop − readingOffset, clamped). */
  y: number;
}

/**
 * Tier 3: merge timed line points (where the song has them) with the section
 * boundaries (everywhere else) into one monotonic timeline. Returns null when
 * there aren't enough usable points to beat Tier 2.
 */
export function buildTimedKeyframes(
  linePoints: FlowLinePoint[],
  sectionFrames: FlowKeyframe[] | null,
  maxScroll: number,
): FlowKeyframe[] | null {
  const points: FlowKeyframe[] = [
    ...(sectionFrames ?? []),
    ...linePoints.map((p) => ({ tMs: p.tMs, y: p.y })),
  ];
  if (points.length < 2 || linePoints.length === 0) return null;
  return sanitizeFrames(points, maxScroll);
}

/**
 * Sort by time, clamp, and enforce monotonic y (a keyframe can never scroll
 * BACKWARD — out-of-order transcript stamps become a hold, not a jump back).
 */
export function sanitizeFrames(frames: FlowKeyframe[], maxScroll: number): FlowKeyframe[] | null {
  const sorted = frames
    .filter((f) => Number.isFinite(f.tMs) && Number.isFinite(f.y) && f.tMs >= 0)
    .sort((a, b) => a.tMs - b.tMs);
  if (sorted.length === 0) return null;
  const out: FlowKeyframe[] = [];
  let maxY = 0;
  for (const f of sorted) {
    const y = Math.min(Math.max(f.y, maxY), Math.max(0, maxScroll));
    maxY = y;
    const prev = out[out.length - 1];
    if (prev && prev.tMs === f.tMs) prev.y = y;
    else out.push({ tMs: f.tMs, y });
  }
  if (out[0].tMs > 0) out.unshift({ tMs: 0, y: 0 });
  if (out[out.length - 1].y < maxScroll) {
    // Tail out to the end at the average established pace so the last lines
    // still arrive (a missing final timestamp must not strand the outro).
    const last = out[out.length - 1];
    const pace = last.tMs > 0 && last.y > 0 ? last.tMs / last.y : 80; // ms per px
    out.push({ tMs: last.tMs + (maxScroll - last.y) * pace, y: maxScroll });
  }
  return out.length >= 2 ? out : null;
}

// ── The clock ↔ position mapping ─────────────────────────────────────────────

/** Piecewise-linear position for a performance time. Clamped at both ends. */
export function positionAt(frames: FlowKeyframe[], tMs: number): number {
  if (frames.length === 0) return 0;
  if (tMs <= frames[0].tMs) return frames[0].y;
  for (let i = 1; i < frames.length; i++) {
    if (tMs <= frames[i].tMs) {
      const a = frames[i - 1];
      const b = frames[i];
      const span = b.tMs - a.tMs;
      const f = span > 0 ? (tMs - a.tMs) / span : 1;
      return a.y + (b.y - a.y) * f;
    }
  }
  return frames[frames.length - 1].y;
}

/**
 * Inverse mapping: where in the performance a scroll position sits — how a
 * manual drag re-derives the clock so resume continues from wherever the
 * performer let go. For a held y (flat segment) returns the segment's start.
 */
export function timeAt(frames: FlowKeyframe[], y: number): number {
  if (frames.length === 0) return 0;
  if (y <= frames[0].y) return frames[0].tMs;
  for (let i = 1; i < frames.length; i++) {
    if (y <= frames[i].y) {
      const a = frames[i - 1];
      const b = frames[i];
      const span = b.y - a.y;
      const f = span > 0 ? (y - a.y) / span : 0;
      return a.tMs + (b.tMs - a.tMs) * f;
    }
  }
  return frames[frames.length - 1].tMs;
}

export function totalDurationMs(frames: FlowKeyframe[]): number {
  return frames.length ? frames[frames.length - 1].tMs : 0;
}

// ── The performer's speed, remembered per song ───────────────────────────────

const SPEED_KEY = (songId: string) => `cog-flow-speed:${songId}`;
export const FLOW_SPEED_MIN = 0.5;
export const FLOW_SPEED_MAX = 2;
export const FLOW_SPEED_STEP = 0.05;

export function clampFlowSpeed(multiplier: number): number {
  if (!Number.isFinite(multiplier)) return 1;
  return Math.min(FLOW_SPEED_MAX, Math.max(FLOW_SPEED_MIN, Math.round(multiplier * 100) / 100));
}

/** The speed the performer set last time — so the second run is exactly right. */
export function loadFlowSpeed(songId: string): number {
  try {
    if (typeof localStorage === "undefined" || !songId) return 1;
    const raw = localStorage.getItem(SPEED_KEY(songId));
    if (!raw) return 1;
    return clampFlowSpeed(Number(raw));
  } catch {
    return 1;
  }
}

export function saveFlowSpeed(songId: string, multiplier: number): void {
  try {
    if (typeof localStorage === "undefined" || !songId) return;
    localStorage.setItem(SPEED_KEY(songId), String(clampFlowSpeed(multiplier)));
  } catch {
    /* memory is a nicety — Flow still works at the default */
  }
}
