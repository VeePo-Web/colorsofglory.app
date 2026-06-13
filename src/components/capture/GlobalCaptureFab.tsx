import { Mic, Square } from "lucide-react";
import type { RecorderPhase } from "@/hooks/useVoiceRecorder";

interface GlobalCaptureFabProps {
  phase: RecorderPhase;
  onToggle: () => void;
}

const IDLE_BG = "#B8953A";
const RECORDING_BG = "#E05440";

/**
 * Persistent global capture entry point — visible from the Song Catalog and
 * inside any Song Workspace. Tap to start, tap to stop (mirrors iOS Voice
 * Memos): songwriters are usually holding an instrument while humming an idea,
 * so a hold gesture would fight the very moment we're trying to catch.
 */
const GlobalCaptureFab = ({ phase, onToggle }: GlobalCaptureFabProps) => {
  const isRecording = phase === "recording";
  const isBusy = phase === "requesting-permission" || phase === "stopping";

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        disabled={isBusy}
        className="fixed flex items-center justify-center rounded-full transition-all duration-150 active:scale-95 disabled:opacity-60"
        style={{
          right: 20,
          bottom: "calc(96px + env(safe-area-inset-bottom))",
          width: 60,
          height: 60,
          zIndex: 510,
          backgroundColor: isRecording ? RECORDING_BG : IDLE_BG,
          border: "none",
          color: "#FFFFFF",
          boxShadow: isRecording
            ? "0 0 0 6px rgba(224,84,64,0.18), 0 4px 16px rgba(224,84,64,0.45)"
            : "0 8px 24px rgba(184,149,58,0.38)",
          animation: isRecording ? "global-capture-pulse 1.4s ease-in-out infinite" : "none",
        }}
        aria-label={isRecording ? "Stop recording idea" : "Record a new idea"}
        aria-pressed={isRecording}
      >
        {isRecording ? <Square size={22} strokeWidth={2} fill="#FFFFFF" /> : <Mic size={24} strokeWidth={2} />}
      </button>

      <style>{`
        @keyframes global-capture-pulse {
          0%, 100% { box-shadow: 0 0 0 6px rgba(224,84,64,0.18), 0 4px 16px rgba(224,84,64,0.45); }
          50%       { box-shadow: 0 0 0 14px rgba(224,84,64,0.08), 0 4px 16px rgba(224,84,64,0.45); }
        }
      `}</style>
    </>
  );
};

export default GlobalCaptureFab;
