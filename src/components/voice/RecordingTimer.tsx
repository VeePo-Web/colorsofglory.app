import { formatDurationLive } from "@/lib/voice/audioFormat";

interface RecordingTimerProps {
  durationMs: number;
}

/**
 * Charcoal tabular-nums timer that updates every 100ms from the recorder state.
 * Deliberately NOT alarm-red: an active recording in Colors of Glory reads as a
 * calm, present count — matching the gold waveform and charcoal stop button.
 * tabular-nums keeps the digits from jittering as the seconds tick.
 */
const RecordingTimer = ({ durationMs }: RecordingTimerProps) => (
  <p
    style={{
      fontFamily: "var(--font-body)",
      fontSize: 52,
      fontWeight: 700,
      color: "var(--cog-charcoal)",
      letterSpacing: "-0.02em",
      fontVariantNumeric: "tabular-nums",
      lineHeight: 1,
      margin: 0,
      userSelect: "none",
    }}
    aria-live="off"
    aria-label={`Recording duration: ${formatDurationLive(durationMs)}`}
  >
    {formatDurationLive(durationMs)}
  </p>
);

export default RecordingTimer;
