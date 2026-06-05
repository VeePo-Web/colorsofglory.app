import { formatDurationLive } from "@/lib/voice/audioFormat";

interface RecordingTimerProps {
  durationMs: number;
}

/** Red tabular-nums timer that updates every 100ms from the recorder state. */
const RecordingTimer = ({ durationMs }: RecordingTimerProps) => (
  <p
    style={{
      fontFamily: "var(--font-body)",
      fontSize: 52,
      fontWeight: 700,
      color: "#E05440",
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
