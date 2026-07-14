import { useCallback, useSyncExternalStore } from "react";
import {
  clickCountIn,
  clickSetBpm,
  clickStart,
  clickStop,
  clickSupported,
  getClickState,
  subscribeClick,
  type ClickBeat,
} from "@/lib/audio/clickTransport";

/**
 * useMetronome — a React VIEW over the ONE app-wide click transport
 * (lib/audio/clickTransport). Capture's scene, the canvas record flow, and
 * the recording sheet's beat strip all read the SAME running click and the
 * same beat — no hook instance ever owns a private engine, so two surfaces
 * can never tick two clicks against each other, and a strip mounted mid-take
 * sees the count-in/beat the record flow started.
 *
 * The engine underneath enforces the never-bleed invariant per scheduled
 * click: while a recording is armed, the click is audible only into a
 * CONFIRMED headphone/earbud output — on a speaker it runs silent while
 * `beat` keeps firing for the visual pulse (and haptics).
 *
 * API kept intentionally compatible with the original capture hook:
 *   • `prime()` — gesture-first idiom shim (the transport resumes in start).
 *   • `countIn(bpm, beats)` — one audible bar; resolves as the first REAL
 *     beat lands and the click CONTINUES seamlessly. HANG-PROOF: the promise
 *     always resolves (downbeat, stop/cancel, engine failure, or wall-clock
 *     fallback). Open the mic on resolve.
 *   • `start(bpm, beatsPerBar)` — steady click; live-retunes if running.
 *   • `stop()` — silence + clear.
 */

export type MetronomeBeat = ClickBeat;

export interface UseMetronomeReturn {
  /** Resume-ready: call inside a user gesture before awaiting. */
  prime: () => void;
  /** One count-in bar of `beats`; resolves as the first real beat sounds. */
  countIn: (bpm: number, beats?: number) => Promise<void>;
  /** Start (or live-retune) a steady click at `bpm`. */
  start: (bpm: number, beatsPerBar?: number) => void;
  /** Stop the click. */
  stop: () => void;
  /** True once an AudioContext can be created (not SSR / unsupported). */
  supported: boolean;
  running: boolean;
  /** The beat that just landed (null when idle) — drives the visual pulse. */
  beat: MetronomeBeat | null;
  setBpm: (bpm: number) => void;
}

export function useMetronome(): UseMetronomeReturn {
  // Refcounted teardown lives in the transport: when the LAST mounted view
  // unsubscribes (route change, full unmount), the click stops and the audio
  // graph is released — a beat never ticks on with nobody left to silence it.
  const snapshot = useSyncExternalStore(subscribeClick, getClickState, getClickState);

  const prime = useCallback(() => {
    // The transport resumes its context inside start(); prime exists so
    // callers can keep the gesture-first idiom.
  }, []);

  const countIn = useCallback((bpm: number, beats = 4) => clickCountIn(bpm, beats), []);
  const start = useCallback((bpm: number, beatsPerBar = 4) => clickStart(bpm, beatsPerBar), []);
  const stop = useCallback(() => clickStop(), []);
  const setBpm = useCallback((bpm: number) => clickSetBpm(bpm), []);

  return {
    prime,
    countIn,
    start,
    stop,
    supported: clickSupported(),
    running: snapshot.running,
    beat: snapshot.beat,
    setBpm,
  };
}
