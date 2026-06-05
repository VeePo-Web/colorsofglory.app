import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import RecordingWaveform from "./RecordingWaveform";
import RecordingTimer from "./RecordingTimer";
import SectionChip from "./SectionChip";
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
 * RecordingSheet — the bottom sheet that slides up during active recording.
 * Also handles permission-denied state.
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
  const [visible, setVisible] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Trigger slide-up animation on mount
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const isRecording = phase === "recording";
  const isDenied = phase === "permission-denied";
  const isStopping = phase === "stopping";

  return (
    <>
      {/* Frosted backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 799,
          backgroundColor: "rgba(26,26,26,0.65)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 300ms ease",
        }}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isDenied ? "Microphone permission required" : "Recording in progress"}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 800,
          backgroundColor: "#FAFAF6",
          borderRadius: "24px 24px 0 0",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.20)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
          minHeight: 340,
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 9999,
            backgroundColor: "#CCC",
            margin: "12px auto 0",
          }}
          aria-hidden="true"
        />

        {/* ── Permission denied state ── */}
        {isDenied ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              padding: "32px 32px 0",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: "rgba(184,149,58,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Mic size={28} style={{ color: "#B8953A" }} />
            </div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
              Microphone access needed
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#666", lineHeight: 1.5, margin: 0 }}>
              Colors of Glory can't hear your music without microphone permission. Tap below to open Settings.
            </p>
            {error && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "#E05440", margin: 0 }}>
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={onOpenSettings}
              style={{
                marginTop: 8,
                height: 48,
                padding: "0 28px",
                borderRadius: 9999,
                backgroundColor: "#B8953A",
                color: "#FFFFFF",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              Open Settings →
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                marginTop: 4,
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "#999",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          /* ── Active recording state ── */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "20px 24px 0",
              gap: 0,
            }}
          >
            {/* Section chip */}
            <SectionChip
              value={section}
              onChange={onSectionChange}
              disabled={isStopping}
            />

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
                color: "#666",
                textAlign: "center",
                caretColor: "#B8953A",
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
                color: "#999",
                marginTop: 8,
                marginBottom: 24,
              }}
            >
              {isStopping ? "Saving..." : "Recording..."}
            </p>

            {/* Stop button */}
            <button
              type="button"
              onClick={onStop}
              disabled={isStopping}
              style={{
                width: 180,
                height: 52,
                borderRadius: 9999,
                backgroundColor: isStopping ? "#CCC" : "#E05440",
                color: "#FFFFFF",
                fontFamily: "var(--font-body)",
                fontSize: 16,
                fontWeight: 700,
                border: "none",
                cursor: isStopping ? "not-allowed" : "pointer",
                boxShadow: isStopping ? "none" : "0 4px 16px rgba(224,84,64,0.40)",
                transition: "transform 120ms ease, background-color 200ms ease",
                userSelect: "none",
              }}
              onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              aria-label="Stop recording"
            >
              {isStopping ? "Saving..." : "Stop"}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default RecordingSheet;
