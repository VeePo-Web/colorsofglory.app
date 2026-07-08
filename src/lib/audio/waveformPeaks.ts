/**
 * waveformPeaks — real playback waveforms (Law 3: real audio, never fake).
 *
 * Peaks are computed ONCE per take — right after the blob exists (capture stop
 * or file import), never per render — by decoding the audio offline and
 * downsampling to a fixed bar count of normalized amplitudes. They persist
 * through `finalizeUpload({ waveformPeaks })` into `voice_memos.waveform_peaks`
 * / `takes.waveform_peaks`, and every card/player renders them by mapping the
 * number[] to bar heights. The ID-seeded `generateWaveform` fallback is for
 * legacy rows with null peaks ONLY.
 *
 * Same OfflineAudioContext approach as volumeNormalizer — no audio library.
 */

/** Canonical persisted bar count. Cards resample down from this. */
export const PEAK_BAR_COUNT = 44;

/**
 * Decode a recorded/imported blob and return PEAK_BAR_COUNT normalized
 * (0.05–1.0) amplitude values. Returns null when the audio can't be decoded
 * (corrupt file, unsupported codec) — callers persist null and the seed
 * fallback keeps the card readable.
 */
export async function computeWaveformPeaks(
  blob: Blob,
  barCount = PEAK_BAR_COUNT,
): Promise<number[] | null> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    if (decoded.length === 0) return null;

    // Mix channels by taking the max |sample| per window across channels.
    const windowSize = Math.max(1, Math.floor(decoded.length / barCount));
    const peaks = new Array<number>(barCount).fill(0);
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const data = decoded.getChannelData(ch);
      for (let bar = 0; bar < barCount; bar++) {
        const start = bar * windowSize;
        const end = Math.min(start + windowSize, data.length);
        let max = 0;
        for (let i = start; i < end; i++) {
          const abs = Math.abs(data[i]);
          if (abs > max) max = abs;
        }
        if (max > peaks[bar]) peaks[bar] = max;
      }
    }

    // Normalize so the loudest bar reaches 1.0 and silence still draws a hairline.
    const loudest = Math.max(...peaks);
    if (loudest < 0.001) return null; // pure silence — nothing real to show
    return peaks.map((p) => Math.max(0.05, Math.min(1, p / loudest)));
  } catch {
    return null;
  }
}

/**
 * Resample persisted peaks to a card's bar count (e.g. HumCard's 8 raw bars,
 * the list item's 8 mini bars). Max-pooling keeps transients visible when
 * downsampling. Pure and cheap — safe to call every render.
 */
export function resamplePeaks(peaks: number[], barCount: number): number[] {
  if (peaks.length === 0) return [];
  if (peaks.length === barCount) return peaks;
  const out = new Array<number>(barCount).fill(0);
  for (let bar = 0; bar < barCount; bar++) {
    const start = Math.floor((bar * peaks.length) / barCount);
    const end = Math.max(start + 1, Math.floor(((bar + 1) * peaks.length) / barCount));
    let max = 0;
    for (let i = start; i < end && i < peaks.length; i++) {
      if (peaks[i] > max) max = peaks[i];
    }
    out[bar] = max;
  }
  return out;
}
