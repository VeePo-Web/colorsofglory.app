/**
 * Acoustic silence detection for a finished take.
 *
 * Decodes an audio blob in the browser and returns suggested section
 * boundaries based on sustained low-RMS regions. Pure DOM API — no extra
 * deps. The actual scanning fn is exported separately so it can be unit
 * tested with a stub AudioBuffer.
 */

export interface SilenceSplitOptions {
  /** Window size in ms used to compute rolling RMS. Default 80ms. */
  windowMs?: number;
  /** RMS threshold below which a window counts as silence (0..1). Default 0.02. */
  silenceRms?: number;
  /** Minimum gap length to emit a boundary, in ms. Default 1600ms. */
  minGapMs?: number;
  /** Don't emit splits inside the first or last `edgePadMs` of the take. Default 600. */
  edgePadMs?: number;
}

/**
 * Detect silence-based split points (in ms) inside an AudioBuffer.
 * Pure function — no Web Audio context needed at call time.
 */
export function findSilenceBoundaries(
  buffer: { sampleRate: number; length: number; numberOfChannels: number; getChannelData: (ch: number) => Float32Array },
  opts: SilenceSplitOptions = {},
): number[] {
  const windowMs = opts.windowMs ?? 80;
  const silenceRms = opts.silenceRms ?? 0.02;
  const minGapMs = opts.minGapMs ?? 1600;
  const edgePadMs = opts.edgePadMs ?? 600;

  const sampleRate = buffer.sampleRate;
  const totalSamples = buffer.length;
  const totalMs = Math.round((totalSamples / sampleRate) * 1000);
  if (totalMs <= edgePadMs * 2 + minGapMs) return [];

  const windowSamples = Math.max(1, Math.round((windowMs / 1000) * sampleRate));
  const ch0 = buffer.getChannelData(0);
  // Mix in a second channel if it exists for a slightly more honest RMS.
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;

  const boundaries: number[] = [];
  let gapStartMs: number | null = null;

  for (let s = 0; s + windowSamples <= totalSamples; s += windowSamples) {
    let sum = 0;
    for (let i = 0; i < windowSamples; i += 1) {
      const v0 = ch0[s + i] ?? 0;
      const v1 = ch1 ? (ch1[s + i] ?? 0) : 0;
      const v = ch1 ? (v0 + v1) * 0.5 : v0;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / windowSamples);
    const windowEndMs = Math.round(((s + windowSamples) / sampleRate) * 1000);

    if (rms < silenceRms) {
      if (gapStartMs == null) gapStartMs = windowEndMs - windowMs;
    } else {
      if (gapStartMs != null) {
        const gapLen = windowEndMs - windowMs - gapStartMs;
        if (gapLen >= minGapMs) {
          // Boundary lands at the *middle* of the silence gap.
          const at = Math.round(gapStartMs + gapLen / 2);
          if (at > edgePadMs && at < totalMs - edgePadMs) {
            boundaries.push(at);
          }
        }
        gapStartMs = null;
      }
    }
  }

  // Dedup boundaries that landed within 400ms of each other.
  return boundaries.filter((b, i) => i === 0 || b - boundaries[i - 1] > 400);
}

/** Decode a Blob into an AudioBuffer and return suggested split points (ms). */
export async function detectSilenceSplits(
  blob: Blob,
  opts: SilenceSplitOptions = {},
): Promise<number[]> {
  if (typeof window === "undefined") return [];
  const Ctx =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return [];
  const arr = await blob.arrayBuffer();
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(arr.slice(0));
    return findSilenceBoundaries(buf, opts);
  } catch {
    return [];
  } finally {
    try { await ctx.close(); } catch { /* ignore */ }
  }
}