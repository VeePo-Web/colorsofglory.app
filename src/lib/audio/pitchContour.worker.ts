/**
 * pitchContour.worker — runs the expensive YIN + cleanup off the main thread.
 *
 * The whole-recording pitch analysis is billions of FP ops for a long take;
 * on the main thread it would freeze capture for seconds. This worker takes
 * the (already band-passed) mono PCM and returns the two persisted shapes, so
 * capture stays instant and the blob is durable BEFORE any pitch work runs.
 * Pure compute only — the pure pipeline lives in pitchContour.ts.
 */
import { contourFromPcm, type PitchContourResult } from "./pitchContour";

interface Req {
  pcm: Float32Array;
  sampleRate: number;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { pcm, sampleRate } = e.data;
  let result: PitchContourResult | null = null;
  try {
    result = contourFromPcm(pcm, sampleRate);
  } catch {
    result = null;
  }
  (self as unknown as Worker).postMessage(result);
};
