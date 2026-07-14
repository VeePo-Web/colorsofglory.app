/**
 * referenceGuide — the audible base take during "record over this" (F16).
 *
 * The vision wants the base playing as a guide while the layer is recorded.
 * On a speaker that guide would bleed straight into the new take, so it is
 * permitted ONLY when the session authority confirms a headphone output —
 * the same never-bleed invariant as the click, checked here at start AND
 * enforced live: if the route flips mid-take (earbuds unplugged), the guide
 * pauses that instant. On a speaker the songwriter gets the visual beat and
 * a calm "put on earbuds to hear the take" hint instead.
 *
 * It also timestamps actual playback start so the caller can compute the
 * layer's alignment offset: recorded-layer time = base time + (guide start −
 * recorder start) + round-trip latency. See alignmentStore.
 */

import { canPlayReferenceAloud, subscribeAudioSession } from "./audioSession";
import { getEngineAudioContext } from "./metronome";
import { audioCache } from "@/lib/voice/audioCache";
import { getSignedUrl } from "@/lib/voice/voiceApi";

export interface GuideHandle {
  /** performance.now() at the moment audio actually started. */
  startedAtMs: number;
  /** Device round-trip estimate (output + mic paths) at start time, in ms. */
  latencyEstimateMs: number;
  stop: () => void;
}

/**
 * Rough device round-trip estimate (output path + mic path), in ms, from the
 * best signals the platform exposes. Chrome reports outputLatency; Safari
 * only baseLatency; the mic input path is never reported anywhere, so a
 * small constant stands in. Alignment is a correction, not sample-accuracy —
 * being ~20ms conservative still beats the uncorrected 100–300ms drift.
 */
export function estimateRoundTripLatencyMs(ctx: AudioContext | null | undefined): number {
  const base = ctx?.baseLatency ?? 0;
  const output =
    (ctx as (AudioContext & { outputLatency?: number }) | null | undefined)?.outputLatency ?? 0.03;
  const inputEstimate = 0.02;
  return Math.round((base + output + inputEstimate) * 1000);
}

/**
 * Start the base take aloud as a record-over guide. Returns null when the
 * invariant forbids it (no confirmed headphones while the mic is armed) or
 * the audio can't be resolved — callers fall back to the visual beat, never
 * to a speaker guide. Must be reached from a user gesture (iOS autoplay).
 */
export async function playReferenceGuide(memoId: string): Promise<GuideHandle | null> {
  if (!canPlayReferenceAloud()) return null;

  let url: string;
  let objectUrl: string | null = null;
  try {
    const cached = await audioCache.get(memoId);
    if (cached) {
      objectUrl = URL.createObjectURL(cached);
      url = objectUrl;
    } else {
      url = await getSignedUrl(memoId);
      audioCache.prefetch(memoId, url);
    }
  } catch {
    return null; // guide is an aid — never block the take on it
  }

  const el = new Audio();
  el.preload = "auto";
  el.src = url;

  let unsubscribe: (() => void) | null = null;
  const stop = () => {
    unsubscribe?.();
    unsubscribe = null;
    el.pause();
    el.src = "";
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };

  try {
    await el.play();
  } catch {
    // The record flow reaches here after a count-in + getUserMedia — a long
    // await chain that can outlive iOS's transient user activation and get
    // play() rejected. One short retry usually lands (the element is loaded
    // by now); if the platform still refuses, degrade to the visual beat —
    // never block or lose the take over its guide.
    await new Promise((r) => setTimeout(r, 120));
    try {
      await el.play();
    } catch {
      stop();
      return null;
    }
  }
  const startedAtMs = performance.now();

  // Live enforcement: the instant headphones disappear, the guide is silent.
  unsubscribe = subscribeAudioSession(() => {
    if (!canPlayReferenceAloud()) stop();
  });
  el.onended = () => stop();

  return {
    startedAtMs,
    latencyEstimateMs: estimateRoundTripLatencyMs(getEngineAudioContext()),
    stop,
  };
}
