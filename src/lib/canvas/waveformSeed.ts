/**
 * Deterministic waveform bar height generator.
 * Same cardId → same waveform shape every render. No randomness.
 * Produces a diamond envelope (taller in the middle) matching the reference image.
 */

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
