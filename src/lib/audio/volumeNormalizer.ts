const TARGET_PEAK = 0.88;
const MAX_GAIN    = 8;
const gainCache   = new Map<string, number>();

/**
 * Analyzes a blob's peak amplitude and returns a gain multiplier
 * that will bring it close to TARGET_PEAK. Result is cached by memoId.
 * Returns 1.0 on any error (no-op gain).
 */
export async function computeNormalizationGain(
  memoId: string,
  blob: Blob,
): Promise<number> {
  const cached = gainCache.get(memoId);
  if (cached !== undefined) return cached;

  try {
    const arrayBuffer = await blob.arrayBuffer();
    // Use a minimal OfflineAudioContext — 1 channel, 1 sample, standard rate
    // We just need decodeAudioData; we won't actually render anything.
    const audioCtx = new OfflineAudioContext(1, 1, 44100);
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);

    // Check first 8 seconds (or full file if shorter)
    const sampleLimit = Math.min(decoded.length, decoded.sampleRate * 8);
    let maxAbs = 0;
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < sampleLimit; i++) {
        const abs = Math.abs(data[i]);
        if (abs > maxAbs) maxAbs = abs;
      }
    }

    if (maxAbs < 0.01) {
      gainCache.set(memoId, 1);
      return 1;
    }

    const gain = Math.min(TARGET_PEAK / maxAbs, MAX_GAIN);
    gainCache.set(memoId, gain);
    return gain;
  } catch {
    gainCache.set(memoId, 1);
    return 1;
  }
}

/** Clears the in-memory gain cache (call when the session ends). */
export function clearGainCache(): void {
  gainCache.clear();
}
