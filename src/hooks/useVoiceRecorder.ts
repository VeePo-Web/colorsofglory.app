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
}

export interface VoiceRecorderState {
  phase: RecorderPhase;
  durationMs: number;
  analyserNode: AnalyserNode | null;
  error: string | null;
}

export interface UseVoiceRecorderReturn {
  state: VoiceRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<RecordingResult | null>;
  cancelRecording: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
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
  const resolveStopRef = useRef<((r: RecordingResult) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

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

  const startRecording = useCallback(async () => {
    setState((s) => ({ ...s, phase: "requesting-permission", error: null }));

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
    } catch (err) {
      const domErr = err as DOMException;
      if (domErr.name === "NotAllowedError" || domErr.name === "PermissionDeniedError") {
        setState((s) => ({ ...s, phase: "permission-denied", error: null }));
      } else {
        setState((s) => ({
          ...s,
          phase: "error",
          error: "Could not access microphone. Please check your device.",
        }));
      }
      return;
    }

    streamRef.current = stream;

    // Web Audio AnalyserNode for real-time waveform
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    audioContextRef.current = audioCtx;
    analyserRef.current = analyser;

    // MediaRecorder
    const mimeType = getBestMimeType();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType, audioBitsPerSecond: 128_000 } : {}
    );
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });
      const durationMs = Date.now() - startTimeRef.current;
      resolveStopRef.current?.({ blob, mimeType: recorder.mimeType || mimeType, durationMs });
      resolveStopRef.current = null;
    };
    recorder.start(100); // collect chunks every 100ms
    mediaRecorderRef.current = recorder;
    startTimeRef.current = Date.now();

    // Live duration ticker
    timerRef.current = setInterval(() => {
      setState((s) =>
        s.phase === "recording"
          ? { ...s, durationMs: Date.now() - startTimeRef.current }
          : s
      );
    }, 100);

    setState({
      phase: "recording",
      durationMs: 0,
      analyserNode: analyser,
      error: null,
    });
  }, []);

  const stopRecording = useCallback((): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        cleanup();
        setState((s) => ({ ...s, phase: "idle", analyserNode: null }));
        resolve(null);
        return;
      }

      setState((s) => ({ ...s, phase: "stopping" }));
      if (timerRef.current) clearInterval(timerRef.current);

      resolveStopRef.current = (result) => {
        cleanup();
        setState({
          phase: "done",
          durationMs: result.durationMs,
          analyserNode: null,
          error: null,
        });
        resolve(result);
      };

      recorder.stop();
    });
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Remove the onstop handler so it doesn't resolve
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    setState({ phase: "idle", durationMs: 0, analyserNode: null, error: null });
  }, [cleanup]);

  return { state, startRecording, stopRecording, cancelRecording };
}
