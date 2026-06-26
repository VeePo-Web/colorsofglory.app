import { Square } from "lucide-react";

interface CaptureStopButtonProps {
  isStopping: boolean;
  onStop: () => void;
}

/**
 * CaptureStopButton — ends a take. Deliberately charcoal with a filled square
 * (the universal "stop" glyph) instead of an alarm red: an active recording in
 * Colors of Glory reads as reverent, matching the gold live waveform. Red has no
 * place in the COG palette, and a worship idea being captured is not an emergency.
 */
const CaptureStopButton = ({ isStopping, onStop }: CaptureStopButtonProps) => (
  <button
    type="button"
    onClick={onStop}
    disabled={isStopping}
    style={{
      width: 180,
      height: 52,
      borderRadius: 9999,
      backgroundColor: isStopping ? "var(--cog-muted)" : "var(--cog-charcoal)",
      color: "#FFFFFF",
      fontFamily: "var(--font-body)",
      fontSize: 16,
      fontWeight: 700,
      border: "none",
      cursor: isStopping ? "not-allowed" : "pointer",
      boxShadow: isStopping ? "none" : "0 4px 16px rgba(28,26,23,0.22)",
      transition: "transform 120ms ease, background-color 200ms ease",
      userSelect: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    }}
    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.97)"; }}
    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
    aria-label="Stop recording"
  >
    {!isStopping && <Square size={13} fill="#FFFFFF" strokeWidth={0} />}
    {isStopping ? "Saving…" : "Stop"}
  </button>
);

export default CaptureStopButton;
