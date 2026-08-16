import { Square } from "lucide-react";

interface CaptureStopButtonProps {
  /** During the count-in nothing is recording — the button's real job is
   *  cancelling the count-in, and its words must say so. */
  countingIn?: boolean;
  isStopping: boolean;
  onStop: () => void;
}

/**
 * CaptureStopButton — ends a take. Deliberately charcoal with a filled square
 * (the universal "stop" glyph) instead of an alarm red: an active recording in
 * Colors of Glory reads as reverent, matching the gold live waveform. Red has no
 * place in the COG palette, and a worship idea being captured is not an emergency.
 */
const CaptureStopButton = ({ isStopping, onStop, countingIn = false }: CaptureStopButtonProps) => (
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
    // CSS :active, not mouse events — iOS Safari synthesizes mouse events
    // only after touchend, so the press never rendered under a thumb.
    className="cog-press"
    aria-label={countingIn ? "Cancel the count-in" : "Stop recording"}
  >
    {!isStopping && <Square size={13} fill="#FFFFFF" strokeWidth={0} />}
    {isStopping ? "Saving…" : countingIn ? "Cancel" : "Stop"}
  </button>
);

export default CaptureStopButton;
