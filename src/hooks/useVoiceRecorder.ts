import { useCallback, useEffect, useRef, useState } from "react";
import { getBestMimeType } from "@/lib/voice/audioFormat";

export type RecorderPhase =
  | "idle"
  | "requesting-permission"
  | "permission-denied"
  | "recording"
  | "stopping"
  | "done"
  | "error";

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  /** How the recording ended — lets the UI explain auto-saves to the songwriter. */
  reason: "manual" | "max-duration" | "interrupted" | "page-hidden";
}

export interface VoiceRecorderState {
  phase: RecorderPhase;
  durationMs: number;
  analyserNode: AnalyserNode | null;
  error: string | null;
}

export interface UseVoiceRecorderOptions {
  /**
   * Hard ceiling on a single take. Protects low-end devices from runaway
   * blobs (OOM) and keeps uploads sane at scale. On hit, the take is SAVED,
   * not discarded. Default 10 minutes.
   */
  maxDurationMs?: number;
  /**
   * Fires when a recording finalizes *without* an awaited stopRecording() call
   * — i.e. an auto-save from an interruption (call, Bluetooth swap), the
   * max-duration ceiling, or the page being hidden. `null` means the salvaged
   * take was empty. This is how an idea survives events the UI never asked for.
   */
  onAutoFinalize?: (result: RecordingResult | null) => void;
}

export interface UseVoiceRecorderReturn {
  state: VoiceRecorderState;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<RecordingResult | null>;
  cancelRecording: () => void;
}

const DEFAULT_MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/** Cross-browser AudioContext constructor (Safari/iOS expose webkitAudioContext). */
function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

/**
 * close()/resume() are specced to return a Promise, but not every engine
 * actually does — calling .catch on a non-thenable return crashes (notably
 * during teardown). These wrappers tolerate a void return and never throw.
 */
function safeCloseContext(ctx: AudioContext | null): void {
  if (!ctx) return;
  try {
    const r = ctx.close() as unknown;
    if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => {});
  } catch {
    /* noop */
  }
}

/**
 * Force MediaRecorder to emit its buffered audio BEFORE stop(). We start the
 * recorder with no timeslice (the most iOS-robust config), which means audio is
 * only delivered to ondataavailable when the browser flushes — and on several
 * engines stop()'s implicit flush is unreliable and yields a 0-byte blob, so the
 * take "records" but saves nothing. requestData() guarantees the buffered audio
 * lands in chunks first; the subsequent onstop then always sees real data.
 * No-ops safely where requestData is unsupported (falls back to stop()'s flush).
 */
function flushBeforeStop(recorder: MediaRecorder): void {
  try {
    const mime = (recorder.mimeType || "").toLowerCase();
    // Only force an extra flush on STREAMING containers (webm/ogg), where an
    // additional mid-stream chunk concatenates into a valid file. mp4/m4a (iOS
    // Safari's output) is NOT safely concatenable from multiple chunks, so we
    // never requestData there — its single stop() flush is the correct,
    // guaranteed-playable path and must be left alone.
    const concatSafe = mime.includes("webm") || mime.includes("ogg");
    if (concatSafe && recorder.state === "recording" && typeof recorder.requestData === "function") {
      recorder.requestData();
    }
  } catch {
    /* unsupported / wrong state — stop() will still attempt its own flush */
  }
}

function safeResumeContext(ctx: AudioContext): Promise<void> {
  try {
    const r = ctx.resume() as unknown;
    if (r && typeof (r as Promise<void>).then === "function") {
      return (r as Promise<void>).catch(() => {});
    }
  } catch {
    /* noop */
  }
  return Promise.resolve();
}

export function useVoiceRecorder(
  options?: UseVoiceRecorderOptions,
): UseVoiceRecorderReturn {
  const maxDurationMs = options?.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;

  const [state, setState] = useState<VoiceRecorderState>({
    phase: "idle",
    durationMs: 0,
    analyserNode: null,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveStopRef = useRef<((r: RecordingResult | null) => void) | null>(null);
  // Reason for the *next* finalization. Manual stop sets "manual"; interruptions
  // set their own reason just before calling recorder.stop().
  const endReasonRef = useRef<RecordingResult["reason"]>("manual");
  // Guards against concurrent / double-tap starts while async work is in flight.
  const startingRef = useRef(false);

  // Keep the auto-finalize callback fresh without re-subscribing anything.
  const onAutoFinalizeRef = useRef(options?.onAutoFinalize);
  useEffect(() => {
    onAutoFinalizeRef.current = options?.onAutoFinalize;
  });

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    timerRef.current = null;
    maxTimerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    safeCloseContext(audioContextRef.current);
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  // Tear down any live capture if the component using this hook unmounts.
  useEffect(() => cleanup, [cleanup]);

  /**
   * Stop the active recorder for a reason the UI did not explicitly request
   * (interruption, ceiling, page hidden). The recorder's onstop routes the
   * salvaged take to onAutoFinalize. Idempotent and safe to call repeatedly.
   */
  const autoStop = useCallback((reason: RecordingResult["reason"]) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    if (resolveStopRef.current) return; // a manual stop is already finalizing
    endReasonRef.current = reason;
    if (timerRef.current) clearInterval(timerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    timerRef.current = null;
    maxTimerRef.current = null;
    setState((s) => (s.phase === "recording" ? { ...s, phase: "stopping" } : s));
    try {
      flushBeforeStop(recorder);
      recorder.stop();
    } catch {
      /* already inactive */
    }
  }, []);

  // Mobile reality: when the tab is hidden or the app is backgrounded, iOS
  // suspends the recorder and the tail is lost. Salvage the take on the way out
  // rather than letting the idea vanish.
  useEffect(() => {
    if (state.phase !== "recording") return;
    const onHide = () => {
      if (document.visibilityState === "hidden") autoStop("page-hidden");
    };
    const onPageHide = () => autoStop("page-hidden");
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [state.phase, autoStop]);

  // beforeunload guard while recording
  useEffect(() => {
    if (state.phase !== "recording") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state.phase]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    // Concurrency guard: ignore double-taps and starts while one is in flight
    // or a recording is already live. Without this, an impatient tap spawns a
    // second getUserMedia + AudioContext and leaks the mic.
    if (startingRef.current) return false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") return true;
    startingRef.current = true;

    try {
      if (typeof MediaRecorder === "undefined") {
        setState((s) => ({
          ...s,
          phase: "error",
          error: "Recording isn't supported in this browser.",
        }));
        return false;
      }

      setState((s) => ({ ...s, phase: "requesting-permission", error: null }));

      // Create + kick the AudioContext as early as possible. iOS Safari starts
      // every AudioContext in "suspended" state and only lets it resume from a
      // user gesture — so we fire resume() now, while the tap's activation is
      // still live, BEFORE the await on getUserMedia consumes it. Without this
      // the AnalyserNode only ever returns silence and the waveform is dead.
      const Ctor = getAudioContextCtor();
      let audioCtx: AudioContext | null = null;
      if (Ctor) {
        try {
          audioCtx = new Ctor();
          if (audioCtx.state === "suspended") void safeResumeContext(audioCtx);
        } catch {
          audioCtx = null;
        }
      }

      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.getUserMedia) {
        safeCloseContext(audioCtx);
        setState((s) => ({
          ...s,
          phase: "error",
          error:
            window.isSecureContext === false
              ? "Recording needs a secure HTTPS connection. Open the published site to record."
              : "Recording isn't supported in this browser.",
        }));
        return false;
      }

      let stream: MediaStream;
      try {
        stream = await mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        safeCloseContext(audioCtx);
        const domErr = err as DOMException;
        if (
          domErr.name === "NotAllowedError" ||
          domErr.name === "PermissionDeniedError" ||
          domErr.name === "SecurityError"
        ) {
          // A cross-origin preview/embed frame without an explicit
          // allow="microphone" policy rejects with NotAllowedError too — and
          // OS Settings can't fix that. Diagnose it so the user opens the real
          // site instead of chasing settings that won't help.
          let framed = false;
          try {
            framed = typeof window !== "undefined" && window.self !== window.top;
          } catch {
            framed = true; // cross-origin access threw → we're definitely framed
          }
          if (framed) {
            setState((s) => ({
              ...s,
              phase: "error",
              error: "Recording is blocked in this preview frame. Open the published site to record.",
            }));
          } else {
            setState((s) => ({ ...s, phase: "permission-denied", error: null }));
          }
        } else if (domErr.name === "NotFoundError" || domErr.name === "DevicesNotFoundError") {
          setState((s) => ({
            ...s,
            phase: "error",
            error: "No microphone found on this device.",
          }));
        } else if (domErr.name === "NotReadableError" || domErr.name === "TrackStartError") {
          // Another app (or tab) holds the mic — common on phones.
          setState((s) => ({
            ...s,
            phase: "error",
            error: "Your microphone is busy in another app. Close it and try again.",
          }));
        } else {
          setState((s) => ({
            ...s,
            phase: "error",
            error: "Could not access the microphone. Please try again.",
          }));
        }
        return false;
      }

      streamRef.current = stream;

      // Wire the AnalyserNode for the live waveform. Best-effort: if anything
      // here fails, recording still proceeds — we just lose the visual meter.
      let analyser: AnalyserNode | null = null;
      if (audioCtx) {
        try {
          if (audioCtx.state === "suspended") {
            await safeResumeContext(audioCtx);
          }
          const source = audioCtx.createMediaStreamSource(stream);
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.8;
          source.connect(analyser);
          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;
        } catch {
          safeCloseContext(audioCtx);
          audioContextRef.current = null;
          analyserRef.current = null;
          analyser = null;
        }
      }

      // MediaRecorder. On iOS Safari MediaRecorder.isTypeSupported is unreliable,
      // so getBestMimeType() may return "" — in that case we let the browser pick
      // its native container (audio/mp4 on iOS), which is the most compatible path.
      const mimeType = getBestMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType, audioBitsPerSecond: 128_000 } : {},
        );
      } catch {
        // Some browsers throw on the options object — retry with bare defaults.
        try {
          recorder = new MediaRecorder(stream);
        } catch {
          cleanup();
          setState({
            phase: "error",
            durationMs: 0,
            analyserNode: null,
            error: "Recording could not start on this device. Please try again.",
          });
          return false;
        }
      }

      endReasonRef.current = "manual";
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = () => {
        cleanup();
        const pending = resolveStopRef.current;
        resolveStopRef.current = null;
        if (pending) {
          pending(null);
        } else {
          onAutoFinalizeRef.current?.(null);
        }
        setState((s) => ({
          ...s,
          phase: "error",
          error: "Recording stopped unexpectedly. Please try again.",
        }));
      };
      recorder.onstop = () => {
        const resolvedType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: resolvedType });
        const durationMs = Date.now() - startTimeRef.current;
        const reason = endReasonRef.current;
        // A 0-byte blob means the capture never produced audio (a known iOS
        // failure mode) — surface it as null so the UI never opens an empty
        // review screen.
        const result: RecordingResult | null =
          blob.size === 0 ? null : { blob, mimeType: resolvedType, durationMs, reason };

        const pending = resolveStopRef.current;
        if (pending) {
          // An awaited stopRecording() is waiting on this. It owns cleanup + state.
          resolveStopRef.current = null;
          pending(result);
        } else {
          // Auto-finalized (interruption / ceiling / page hidden). Salvage it.
          cleanup();
          setState({
            phase: result ? "done" : "error",
            durationMs: result?.durationMs ?? 0,
            analyserNode: null,
            error: result ? null : "That recording came through empty. Please try again.",
          });
          onAutoFinalizeRef.current?.(result);
        }
      };

      // Audio interruptions (incoming call, Siri, Bluetooth/AirPods connect or
      // disconnect, mic yanked) end the track. Salvage whatever we captured
      // instead of letting the idea evaporate.
      const track = stream.getAudioTracks()[0];
      if (track) {
        track.onended = () => autoStop("interrupted");
      }

      // No timeslice: iOS Safari is unreliable with small timeslices (empty or
      // never-flushed chunks → unplayable blob). A single flush on stop() is the
      // most robust path across browsers.
      mediaRecorderRef.current = recorder;
      try {
        recorder.start();
      } catch {
        cleanup();
        setState({
          phase: "error",
          durationMs: 0,
          analyserNode: null,
          error: "Recording could not start after microphone access was granted. Please try again.",
        });
        return false;
      }
      startTimeRef.current = Date.now();

      // Live duration ticker (Date.now() deltas, so it stays accurate even if
      // the interval is throttled while backgrounded).
      timerRef.current = setInterval(() => {
        setState((s) =>
          s.phase === "recording"
            ? { ...s, durationMs: Date.now() - startTimeRef.current }
            : s,
        );
      }, 100);

      // Hard ceiling — auto-save (never discard) when a take runs too long.
      maxTimerRef.current = setTimeout(() => autoStop("max-duration"), maxDurationMs);

      setState({
        phase: "recording",
        durationMs: 0,
        analyserNode: analyser,
        error: null,
      });
      return true;
    } finally {
      startingRef.current = false;
    }
  }, [cleanup, autoStop, maxDurationMs]);

  const stopRecording = useCallback((): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        cleanup();
        setState((s) => ({ ...s, phase: "idle", analyserNode: null }));
        resolve(null);
        return;
      }

      endReasonRef.current = "manual";
      setState((s) => ({ ...s, phase: "stopping" }));
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      timerRef.current = null;
      maxTimerRef.current = null;

      resolveStopRef.current = (result) => {
        cleanup();
        setState({
          phase: result ? "done" : "error",
          durationMs: result?.durationMs ?? 0,
          analyserNode: null,
          error: result ? null : "That recording came through empty. Please try again.",
        });
        resolve(result);
      };

      try {
        flushBeforeStop(recorder);
        recorder.stop();
      } catch {
        const pending = resolveStopRef.current;
        resolveStopRef.current = null;
        pending?.(null);
      }
    });
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Remove handlers so a late onstop/onerror doesn't resolve a discarded take
      recorder.onstop = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      try {
        recorder.stop();
      } catch {
        /* already inactive */
      }
    }
    resolveStopRef.current = null;
    cleanup();
    setState({ phase: "idle", durationMs: 0, analyserNode: null, error: null });
  }, [cleanup]);

  return { state, startRecording, stopRecording, cancelRecording };
}
