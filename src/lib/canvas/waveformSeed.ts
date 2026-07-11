/**
 * Waveform bars for voice surfaces — real melody first, fake last.
 *
 * `resolveWaveformBars` (bottom) is the ONE entry point every card should use,
 * with strict precedence per take:
 *   1. pitch_contour + peaks → the MELODY WAVEFORM: amplitude bars whose
 *      vertical position rides the tune (Melody Lens, C4) — you see loudness
 *      AND shape at once.
 *   2. waveform_peaks only → the real amplitude waveform (bottom-aligned).
 *   3. neither (legacy null) → the deterministic id-seeded fake below —
 *      kept ONLY so a legacy card is never blank.
 */

import { resamplePeaks } from "@/lib/audio/waveformPeaks";
import { resampleContour, UNVOICED } from "@/lib/audio/pitchContour";

/** Generate N bar heights (0.0 – 1.0) from a seed string. */
export function generateWaveform(seed: string, barCount = 20): number[] {
  // Hash the seed to a numeric basis
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
  }

  return Array.from({ length: barCount }, (_, i) => {
    // Perlin-like: several sin waves at different frequencies
    const t = i / (barCount - 1);
    const s1 = Math.sin(h * 0.001 + i * 1.3) * 0.50;
    const s2 = Math.sin(h * 0.003 + i * 0.7) * 0.30;
    const s3 = Math.sin(h * 0.007 + i * 2.1) * 0.20;
    const raw = (s1 + s2 + s3) * 0.5 + 0.5; // normalize to 0–1

    // Diamond envelope: tallest in the middle, shorter at edges
    const envelope = 1 - Math.abs(t * 2 - 1) * 0.45;

    return Math.max(0.10, Math.min(1.0, raw * envelope));
  });
}

/** Max rendered bar height in pixels at 1:1 canvas scale. */
export const MAX_BAR_HEIGHT = 52;

/** Bar width and gap for VoiceMemoCard (200px card, 14px padding each side → 172px usable). */
export const BAR_WIDTH = 5;
export const BAR_GAP = 3;
export const VOICE_BAR_COUNT = 20;

/** Smaller waveform for HumCard — fewer, taller bars = raw feel. */
export const HUM_BAR_COUNT = 8;
export const HUM_MAX_BAR_HEIGHT = 44;

// ─── Melody Lens (C4): the real render, one bar model for every surface ─────

export type WaveformMode = "melody" | "amplitude" | "seed";

export interface WaveformBar {
  /** Bar height in px (within maxHeight). */
  height: number;
  /** Distance from the box top in px — melody bars RIDE the tune. */
  top: number;
  /** False for silent stretches: render dimmed. */
  voiced: boolean;
  /** The bar's amplitude 0–1 (drives the existing opacity recipes). */
  amp: number;
}

export interface ResolvedWaveform {
  mode: WaveformMode;
  bars: WaveformBar[];
}

/** Melody bars leave headroom so pitch movement is visible. */
const MELODY_AMPLITUDE_SHARE = 0.55;
/** Peak-less contour bars render at a steady mid amplitude. */
const FLAT_AMP = 0.6;
const MIN_BAR_PX = 3;

/**
 * The one waveform resolver (precedence: melody → amplitude → seed).
 * Pure and cheap — safe every render; memoize per card as usual.
 */
export function resolveWaveformBars(opts: {
  /** Seed for the legacy fallback (card/memo id). */
  seedId: string;
  peaks?: number[] | null;
  contour?: number[] | null;
  barCount: number;
  maxHeight: number;
}): ResolvedWaveform {
  const { seedId, peaks, contour, barCount, maxHeight } = opts;
  const hasPeaks = Boolean(peaks && peaks.length > 0);
  const hasContour = Boolean(contour && contour.length > 0);

  if (hasContour) {
    const c = resampleContour(contour as number[], barCount);
    const a = hasPeaks
      ? resamplePeaks(peaks as number[], barCount)
      : new Array<number>(barCount).fill(FLAT_AMP);
    const bars: WaveformBar[] = c.map((rawPitch, i) => {
      const amp = a[i] ?? FLAT_AMP;
      const height = Math.max(MIN_BAR_PX, Math.round(amp * maxHeight * MELODY_AMPLITUDE_SHARE));
      const voiced = rawPitch !== UNVOICED;
      // Clamp to [0,1] — device contours are already normalized, but a future
      // server value must never push a bar out of the box (negative top).
      const pitch = Math.max(0, Math.min(1, rawPitch));
      // High pitch → bar rides high in the box; unvoiced → rests centered.
      const travel = maxHeight - height;
      const top = voiced ? Math.round((1 - pitch) * travel) : Math.round(travel / 2);
      return { height, top, voiced, amp };
    });
    return { mode: "melody", bars };
  }

  if (hasPeaks) {
    const a = resamplePeaks(peaks as number[], barCount);
    return {
      mode: "amplitude",
      bars: a.map((amp) => {
        const height = Math.max(MIN_BAR_PX, Math.round(amp * maxHeight));
        return { height, top: maxHeight - height, voiced: true, amp };
      }),
    };
  }

  return {
    mode: "seed",
    bars: generateWaveform(seedId, barCount).map((amp) => {
      const height = Math.max(MIN_BAR_PX, Math.round(amp * maxHeight));
      return { height, top: maxHeight - height, voiced: true, amp };
    }),
  };
}
