import { useCallback, useEffect, useRef } from "react";

/**
 * useMetronome — a Web-Audio click track for the Capture scene.
 *
 * Two jobs, both in service of "hum the idea *in time*":
 *   • `countIn(bpm, beats)` plays N clicks and resolves when the downbeat lands,
 *     so a take starts on the beat instead of whenever the finger lifts.
 *   • `start(bpm)` / `stop()` keep a steady click going while recording.
 *
 * iOS-first doctrine: the AudioContext starts *suspended*; we lazily create it
 * and resume it inside the user gesture that calls `prime()` / `countIn()`,
 * before any `await`. Clicks are scheduled with a short look-ahead so timing
 * stays rock-solid even when the main thread is busy (the classic
 * "A Tale of Two Clocks" scheduler). No DOM, no React state — pure refs, so it
 * never triggers a re-render mid-recording.
 */

const LOOKAHEAD_MS = 25; // how often the scheduler wakes up
const SCHEDULE_AHEAD_S = 0.12; // how far ahead we queue clicks
const ACCENT_HZ = 1600; // downbeat (beat 1)
const TICK_HZ = 1100; // other beats
const CLICK_LEN_S = 0.045;

type AudioCtor = typeof AudioContext;

function getAudioContextCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext ??
    null
  );
}

export interface UseMetronomeReturn {
  /** Resume the audio context inside a user gesture. Call before awaiting. */
  prime: () => void;
  /** Play `beats` clicks at `bpm`; resolves on the final downbeat. */
  countIn: (bpm: number, beats?: number) => Promise<void>;
  /** Start a steady click at `bpm` (accent every `beatsPerBar`). */
  start: (bpm: number, beatsPerBar?: number) => void;
  /** Stop the steady click. */
  stop: () => void;
  /** True once an AudioContext can be created (not SSR / unsupported). */
  supported: boolean;
}

export function useMetronome(): UseMetronomeReturn {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatRef = useRef(0);
  const bpmRef = useRef(120);
  const beatsPerBarRef = useRef(4);
  const supported = getAudioContextCtor() != null;

  const ensureCtx = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    try {
      ctxRef.current = new Ctor();
    } catch {
      return null;
    }
    return ctxRef.current;
  }, []);

  const prime = useCallback(() => {
    const ctx = ensureCtx();
    // resume() must run inside the gesture; ignore the promise rejection on
    // browsers that auto-resume.
    void ctx?.resume().catch(() => {});
  }, [ensureCtx]);

  const click = useCallback((ctx: AudioContext, time: number, accent: boolean) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? ACCENT_HZ : TICK_HZ;
    const peak = accent ? 0.6 : 0.4;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK_LEN_S);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + CLICK_LEN_S + 0.01);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduler = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const secondsPerBeat = 60 / bpmRef.current;
    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_S) {
      const accent = beatRef.current % beatsPerBarRef.current === 0;
      click(ctx, nextNoteTimeRef.current, accent);
      nextNoteTimeRef.current += secondsPerBeat;
      beatRef.current += 1;
    }
  }, [click]);

  const start = useCallback(
    (bpm: number, beatsPerBar = 4) => {
      const ctx = ensureCtx();
      if (!ctx) return;
      void ctx.resume().catch(() => {});
      clearTimer();
      bpmRef.current = bpm;
      beatsPerBarRef.current = beatsPerBar;
      beatRef.current = 0;
      nextNoteTimeRef.current = ctx.currentTime + 0.06;
      scheduler();
      timerRef.current = setInterval(scheduler, LOOKAHEAD_MS);
    },
    [ensureCtx, clearTimer, scheduler],
  );

  const stop = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const countIn = useCallback(
    (bpm: number, beats = 4): Promise<void> => {
      const ctx = ensureCtx();
      if (!ctx) return Promise.resolve();
      void ctx.resume().catch(() => {});
      const secondsPerBeat = 60 / bpm;
      const start0 = ctx.currentTime + 0.08;
      for (let b = 0; b < beats; b += 1) {
        click(ctx, start0 + b * secondsPerBeat, b === 0);
      }
      // Resolve right as the downbeat after the count-in would land.
      const totalMs = (start0 - ctx.currentTime + beats * secondsPerBeat) * 1000;
      return new Promise((resolve) => setTimeout(resolve, Math.max(0, totalMs)));
    },
    [ensureCtx, click],
  );

  // Release the timer (and context) on unmount so a click never outlives the scene.
  useEffect(() => {
    return () => {
      clearTimer();
      void ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [clearTimer]);

  return { prime, countIn, start, stop, supported };
}
