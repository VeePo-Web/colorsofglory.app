import RecordingWaveform from "@/components/voice/RecordingWaveform";
import RecordingTimer from "@/components/voice/RecordingTimer";
import CaptureSheetShell from "@/components/voice/CaptureSheetShell";
import MicPermissionPanel from "@/components/voice/MicPermissionPanel";
import CaptureStopButton from "@/components/voice/CaptureStopButton";
import type { RecorderPhase } from "@/hooks/useVoiceRecorder";

interface CaptureShellProps {
  phase: RecorderPhase;
  durationMs: number;
  analyserNode: AnalyserNode | null;
  error: string | null;
  onStop: () => void;
  onCancel: () => void;
  onOpenSettings: () => void;
}

/**
 * CaptureShell — the bottom sheet for global idea capture. A pared-down
 * RecordingSheet: no section chip, no note field. The whole point of global
 * capture is zero friction between "I have an idea" and "it's recording" —
 * filing it into a song happens later, in the review step. Chrome, the
 * permission-denied state, and the stop control are shared with RecordingSheet.
 */
const CaptureShell = ({
  phase,
  durationMs,
  analyserNode,
  error,
  onStop,
  onCancel,
  onOpenSettings,
}: CaptureShellProps) => {
  const isDenied = phase === "permission-denied";
  const isStopping = phase === "stopping";

  return (
    <CaptureSheetShell
      ariaLabel={isDenied ? "Microphone permission required" : "Capturing idea"}
      onBackdropClick={onCancel}
      minHeight={300}
    >
      {isDenied ? (
        <MicPermissionPanel
          message="Colors of Glory can't hear your idea without microphone permission. Tap below to open Settings."
          error={error}
          onOpenSettings={onOpenSettings}
          onCancel={onCancel}
        />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "28px 24px 0",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              fontWeight: 700,
              color: "var(--cog-charcoal)",
              margin: 0,
            }}
          >
            Capturing your idea
          </p>

          {/* Waveform */}
          <div style={{ marginTop: 22, marginBottom: 18 }}>
            <RecordingWaveform analyserNode={analyserNode} />
          </div>

          {/* Timer */}
          <RecordingTimer durationMs={durationMs} />

          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--cog-muted)",
              marginTop: 8,
              marginBottom: 24,
            }}
          >
            {isStopping ? "Saving…" : "Tap stop when you're done"}
          </p>

          {/* Stop button */}
          <CaptureStopButton isStopping={isStopping} onStop={onStop} />
        </div>
      )}
    </CaptureSheetShell>
  );
};

export default CaptureShell;
