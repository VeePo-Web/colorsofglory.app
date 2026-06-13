import { useCallback, useState } from "react";
import { useVoiceRecorder, type RecorderPhase, type RecordingResult } from "./useVoiceRecorder";
import { useVibration } from "./useVibration";
import { HAPTIC_RECORD_START, HAPTIC_RECORD_STOP } from "@/lib/voice/haptics";

export interface UseGlobalCaptureReturn {
  phase: RecorderPhase;
  durationMs: number;
  analyserNode: AnalyserNode | null;
  error: string | null;
  pendingRecording: RecordingResult | null;
  toggle: () => void;
  discard: () => void;
}

/**
 * Tap-to-start / tap-to-stop capture engine — mirrors iOS Voice Memos.
 * No hold gesture: songwriters are usually holding an instrument while humming an idea.
 */
export function useGlobalCapture(): UseGlobalCaptureReturn {
  const { vibrate } = useVibration();
  const [pendingRecording, setPendingRecording] = useState<RecordingResult | null>(null);

  // An interruption (call / Bluetooth swap), the duration ceiling, or the page
  // being hidden auto-finalizes the take. Catch it so the idea still reaches
  // review instead of vanishing.
  const handleAutoFinalize = useCallback((result: RecordingResult | null) => {
    if (result) setPendingRecording(result);
  }, []);

  const { state, startRecording, stopRecording, cancelRecording } = useVoiceRecorder({
    onAutoFinalize: handleAutoFinalize,
  });

  const toggle = useCallback(() => {
    if (state.phase === "recording") {
      vibrate(HAPTIC_RECORD_STOP);
      void (async () => {
        const result = await stopRecording();
        if (result) setPendingRecording(result);
      })();
      return;
    }

    if (state.phase === "idle" || state.phase === "done" || state.phase === "error") {
      vibrate(HAPTIC_RECORD_START);
      void startRecording();
    }
  }, [state.phase, vibrate, startRecording, stopRecording]);

  const discard = useCallback(() => {
    cancelRecording();
    setPendingRecording(null);
  }, [cancelRecording]);

  return {
    phase: state.phase,
    durationMs: state.durationMs,
    analyserNode: state.analyserNode,
    error: state.error,
    pendingRecording,
    toggle,
    discard,
  };
}
