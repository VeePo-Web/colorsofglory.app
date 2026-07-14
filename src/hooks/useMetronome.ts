import { useCallback, useEffect, useRef, useState } from "react";
import { Metronome } from "@/lib/audio/metronome";

/**
 * useMetronome — the React transport over C4's ONE click engine
 * (src/lib/audio/metronome.ts). Capture's scene, the canvas record flow, and
 * any future surface drive this same class; nobody re-implements a click,
 * because the engine is where the never-bleed invariant lives: while a
 * recording is armed, the click is audible only into a CONFIRMED
 * headphone/earbud output — on a speaker it runs silent while `beat` keeps
 * firing for the visual pulse (and haptics).
 *
 * API kept intentionally compatible with the original capture hook:
 *   • `prime()` — warm the engine inside the user gesture.
 *   • `countIn(bpm, beats)` — one audible bar; resolves on the audio clock as
 *     the first REAL beat lands, and the click CONTINUES seamlessly on the
 *     same grid (session-gated once the mic arms). Open the mic on resolve.
 *   • `start(bpm, beatsPerBar)` — steady click; live-retunes if running.
 *   • `stop()` — silence + clear.
 * Plus `beat` / `running` state for transports that render the pulse.
 */

export interface MetronomeBeat {
  /** 0-indexed beat within the bar. */
  beatInBar: number;
  /** Monotonic counter so effects can fire once per landed beat. */
  seq: number;
}

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
  const engineRef = useRef<Metronome | null>(null);
  // Whether the current instance was built with a count-in bar — a stopped
  // count-in engine must not count in again when restarted as a steady click.
  const engineHasCountInRef = useRef(false);
  const countInResolveRef = useRef<(() => void) | null>(null);
  const seqRef = useRef(0);
  const [beat, setBeat] = useState<MetronomeBeat | null>(null);
  const [running, setRunning] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) != null;

  const disposeEngine = useCallback(() => {
    engineRef.current?.dispose();
    engineRef.current = null;
    engineHasCountInRef.current = false;
  }, []);

  const buildEngine = useCallback(
    (bpm: number, beatsPerBar: number, withCountIn: boolean) => {
      disposeEngine();
      engineRef.current = new Metronome({
        bpm,
        beatsPerBar,
        countIn: withCountIn,
        onBeat: (beatInBar) => {
          seqRef.current += 1;
          setBeat({ beatInBar, seq: seqRef.current });
        },
        onCountInDone: () => {
          const resolve = countInResolveRef.current;
          countInResolveRef.current = null;
          resolve?.();
        },
      });
      engineHasCountInRef.current = withCountIn;
      return engineRef.current;
    },
    [disposeEngine],
  );

  const prime = useCallback(() => {
    // The engine resumes its context inside start(); prime exists so callers
    // can keep the gesture-first idiom and stays cheap when nothing runs yet.
  }, []);

  const countIn = useCallback(
    (bpm: number, beats = 4): Promise<void> => {
      if (!supported) return Promise.resolve();
      const engine = buildEngine(bpm, beats, true);
      return new Promise<void>((resolve) => {
        countInResolveRef.current = resolve;
        setRunning(true);
        void engine.start().catch(() => {
          // No context / resume refused — never strand the take behind a click.
          countInResolveRef.current = null;
          setRunning(false);
          resolve();
        });
      });
    },
    [supported, buildEngine],
  );

  const start = useCallback(
    (bpm: number, beatsPerBar = 4) => {
      if (!supported) return;
      const existing = engineRef.current;
      if (existing?.isRunning) {
        // Live retune — the seamless count-in → take continuation path.
        existing.setBpm(bpm);
        existing.setBeatsPerBar(beatsPerBar);
        setRunning(true);
        return;
      }
      const engine =
        existing && !engineHasCountInRef.current ? existing : buildEngine(bpm, beatsPerBar, false);
      engine.setBpm(bpm);
      engine.setBeatsPerBar(beatsPerBar);
      setRunning(true);
      void engine.start().catch(() => setRunning(false));
    },
    [supported, buildEngine],
  );

  const stop = useCallback(() => {
    engineRef.current?.stop();
    countInResolveRef.current = null;
    setRunning(false);
    setBeat(null);
  }, []);

  const setBpm = useCallback((bpm: number) => {
    engineRef.current?.setBpm(bpm);
  }, []);

  // A surface that mounted a click never leaves it playing after unmount.
  useEffect(() => {
    return () => {
      countInResolveRef.current = null;
      disposeEngine();
    };
  }, [disposeEngine]);

  return { prime, countIn, start, stop, supported, running, beat, setBpm };
}
