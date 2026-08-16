import { useRef, type ReactNode } from "react";
import { GLORY_RECORDING_AURA } from "@/lib/canvas/glorySpectrum";
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
  /** Optional in-take tempo companion (MetronomeStrip) — the visual beat lives here. */
  metronomeSlot?: ReactNode;
  /**
   * True while the count-in bar plays, BEFORE the mic opens. The sheet must
   * say so honestly — "Recording…" over a bar of silence reads as broken, and
   * the Stop button doubles as "cancel the count-in".
   */
  countingIn?: boolean;
  /** The base take's title when this recording is a LAYER over it — the one
   *  fact that tells the writer "sing along with this", on screen the whole
   *  take. Absent for a normal memo. */
  layerOf?: string;
  /** How the sing-along guide actually stands: playing in earbuds, silent
   *  (no earbuds confirmed / couldn't start), or not applicable (null). The
   *  writer must never record into unexplained silence. */
  guide?: "playing" | "silent" | null;
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
  metronomeSlot,
  countingIn = false,
  layerOf,
  guide = null,
}: RecordingSheetProps) => {
  const noteRef = useRef<HTMLInputElement>(null);

  const isDenied = phase === "permission-denied";
  const isStopping = phase === "stopping";
  // The mic-opening moment is narrated too (P1-1): the sheet appears the
  // instant the tap lands, and never claims "Recording" before it's true.
  const isOpening = phase === "requesting-permission";
  const liveStatus = isDenied
    ? "Microphone access needed"
    : isStopping
      ? "Saving your recording"
      : isOpening
        ? "Opening the mic…"
        : countingIn
          ? "Get ready — recording starts on the next beat"
          : layerOf
            ? `Recording over “${layerOf}”`
            : "Recording in progress";

  return (
    <CaptureSheetShell
      ariaLabel={isDenied ? "Microphone permission required" : "Recording in progress"}
      // NEVER let a stray tap on the scrim discard a live take — that would lose
      // a captured idea, the one thing capture must never do. During recording /
      // stopping the only exit is the Stop button, which SAVES. Backdrop-cancel is
      // allowed only in the permission-denied state, where there's nothing to lose.
      onBackdropClick={isDenied ? onCancel : undefined}
      minHeight={340}
      liveStatus={liveStatus}
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
          {/* A layer names its base the whole take — "sing along with this"
              is the feature's one promise, so the promise stays on screen —
              and says plainly whether the guide is actually sounding. */}
          {layerOf ? (
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700,
                  color: "var(--cog-charcoal)",
                }}
              >
                Singing over &ldquo;{layerOf}&rdquo;
              </p>
              <p
                style={{
                  margin: "4px 0 0", fontFamily: "var(--font-body)", fontSize: 11.5, fontWeight: 500,
                  color: "var(--cog-warm-gray)",
                }}
                role="status"
              >
                {guide === "playing"
                  ? "It's playing in your earbuds — sing along."
                  : guide === "silent"
                    ? "Put in earbuds to hear it while you sing."
                    : "Both voices will play together."}
              </p>
            </div>
          ) : (
            <SectionChip value={section} onChange={onSectionChange} disabled={isStopping} />
          )}

          {/* Note label field */}
          <input
            ref={noteRef}
            type="text"
            value={noteValue}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Give it a name while you record…"
            disabled={isStopping}
            // Songwriter-friendly mobile keyboard: capitalize like a title, but no
            // autocorrect/spellcheck mangling creative or non-dictionary labels.
            autoCapitalize="sentences"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === "Enter") noteRef.current?.blur(); }}
            style={{
              marginTop: 16,
              width: "100%",
              border: "none",
              outline: "none",
              backgroundColor: "transparent",
              fontFamily: "var(--font-body)",
              // 16px is the floor that stops iOS Safari from auto-zooming the whole
              // sheet the instant this field is focused.
              fontSize: 16,
              color: "var(--cog-warm-gray)",
              textAlign: "center",
              caretColor: "var(--cog-gold)",
            }}
          />

          {/* Waveform — bathed in a soft glory aura while the take is live
              (the auth-code light, holding the singer). Opacity-only breathe;
              reduced-motion holds it still. */}
          <div style={{ position: "relative", marginTop: 22, marginBottom: 18 }}>
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: "-42px -64px",
                borderRadius: "50%",
                background: GLORY_RECORDING_AURA,
                animation: isStopping ? "none" : "cog-rec-aura 2.6s ease-in-out infinite",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative" }}>
              <RecordingWaveform analyserNode={analyserNode} />
            </div>
            <style>{`
              @keyframes cog-rec-aura {
                0%, 100% { opacity: 1; transform: scale(1); }
                50%       { opacity: 0.72; transform: scale(1.05); }
              }
              @media (prefers-reduced-motion: reduce) {
                [style*="cog-rec-aura"] { animation: none !important; }
              }
            `}</style>
          </div>

          {/* Timer */}
          <RecordingTimer durationMs={durationMs} />

          {/* In-take metronome (visual pulse / click / earbuds) when a tempo exists */}
          {metronomeSlot}

          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--cog-muted)",
              marginTop: 8,
              marginBottom: 24,
            }}
          >
            {isStopping ? "Saving…" : countingIn ? "Count-in — start on the downbeat" : "Recording…"}
          </p>

          {/* Stop button */}
          <CaptureStopButton isStopping={isStopping} onStop={onStop} />
        </div>
      )}
    </CaptureSheetShell>
  );
};

export default RecordingSheet;
