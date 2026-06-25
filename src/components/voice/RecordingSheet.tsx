import { useRef } from "react";
import RecordingWaveform from "./RecordingWaveform";
import RecordingTimer from "./RecordingTimer";
import SectionChip from "./SectionChip";
import CaptureSheetShell from "./CaptureSheetShell";
import MicPermissionPanel from "./MicPermissionPanel";
import CaptureStopButton from "./CaptureStopButton";
import type { RecorderPhase } from "@/hooks/useVoiceRecorder";

interface RecordingSheetProps {
  phase: RecorderPhase;
  durationMs: number;
  analyserNode: AnalyserNode | null;
  error: string | null;
  section: string;
  onSectionChange: (s: string) => void;
  noteValue: string;
  onNoteChange: (v: string) => void;
  onStop: () => void;
  onCancel: () => void;
  onOpenSettings: () => void;
}

/**
 * RecordingSheet — the bottom sheet that slides up during an in-song recording.
 * Chrome (scrim · sheet · handle · motion), the permission-denied state, and the
 * stop control are shared with the global CaptureShell; this component only owns
 * the in-song extras: the section chip and the optional label field.
 */
const RecordingSheet = ({
  phase,
  durationMs,
  analyserNode,
  error,
  section,
  onSectionChange,
  noteValue,
  onNoteChange,
  onStop,
  onCancel,
  onOpenSettings,
}: RecordingSheetProps) => {
  const noteRef = useRef<HTMLInputElement>(null);

  const isDenied = phase === "permission-denied";
  const isStopping = phase === "stopping";

  return (
    <CaptureSheetShell
      ariaLabel={isDenied ? "Microphone permission required" : "Recording in progress"}
      onBackdropClick={onCancel}
      minHeight={340}
    >
      {isDenied ? (
        <MicPermissionPanel
          message="Colors of Glory can't hear your music without microphone permission. Tap below to open Settings."
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
            padding: "20px 24px 0",
          }}
        >
          {/* Section chip */}
          <SectionChip value={section} onChange={onSectionChange} disabled={isStopping} />

          {/* Note label field */}
          <input
            ref={noteRef}
            type="text"
            value={noteValue}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Add a label while you record..."
            disabled={isStopping}
            onKeyDown={(e) => { if (e.key === "Enter") noteRef.current?.blur(); }}
            style={{
              marginTop: 16,
              width: "100%",
              border: "none",
              outline: "none",
              backgroundColor: "transparent",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--cog-warm-gray)",
              textAlign: "center",
              caretColor: "var(--cog-gold)",
            }}
          />

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
            {isStopping ? "Saving…" : "Recording…"}
          </p>

          {/* Stop button */}
          <CaptureStopButton isStopping={isStopping} onStop={onStop} />
        </div>
      )}
    </CaptureSheetShell>
  );
};

export default RecordingSheet;
