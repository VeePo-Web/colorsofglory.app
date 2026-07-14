import { useEffect, useRef } from "react";
import { Headphones } from "lucide-react";
import BeatPulse from "./BeatPulse";
import { useMetronome } from "@/hooks/useMetronome";
import { useAudioSession } from "@/hooks/useAudioSession";
import { useVibration } from "@/hooks/useVibration";

interface MetronomeStripProps {
  /** The song's shared tempo. The strip renders nothing without one. */
  bpm: number | null;
  beatsPerBar?: number;
}

/**
 * MetronomeStrip — the in-take tempo companion, shown inside the recording
 * sheet. While the mic is armed the session authority decides what the click
 * may do: on confirmed earbuds it sounds; on a speaker it runs as this strip's
 * gold visual pulse + a haptic tap (Android; iOS has no vibration API — the
 * visual is always the primary reference, haptic only augments). The copy
 * says which, calmly, and the earbuds toggle is right here so putting
 * headphones on mid-session unlocks the audible click without hunting.
 */
const MetronomeStrip = ({ bpm, beatsPerBar = 4 }: MetronomeStripProps) => {
  const { beat, running, supported, start, stop, prime } = useMetronome();
  const { clickMode, headphonesConfirmed, setHeadphones } = useAudioSession();
  const { vibrate, supported: canVibrate } = useVibration();

  // Haptic on each landed beat — stronger downbeat, lighter ticks. Fires only
  // while the click runs and only augments the visual (never a dependency).
  const lastSeqRef = useRef(0);
  useEffect(() => {
    if (!running || !beat || !canVibrate) return;
    if (beat.seq === lastSeqRef.current) return;
    lastSeqRef.current = beat.seq;
    vibrate(beat.beatInBar === 0 ? 24 : 12);
  }, [beat, running, canVibrate, vibrate]);

  if (!bpm || !supported) return null;

  const silent = clickMode === "silent";
  const status = !running
    ? `${bpm} BPM`
    : silent
      ? "Click: visual — put on earbuds to hear it"
      : "Click: on";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        width: "100%",
        marginTop: 14,
      }}
    >
      {running && (
        <BeatPulse
          beatInBar={beat?.beatInBar ?? null}
          beatsPerBar={beatsPerBar}
          emphasis={silent ? "primary" : "quiet"}
        />
      )}

      <p
        aria-live="polite"
        style={{
          margin: 0,
          fontFamily: "var(--font-body)",
          fontSize: 12,
          color: "var(--cog-warm-gray)",
        }}
      >
        {status}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Click on/off — live during the take; sound vs visual is the session's call. */}
        <button
          type="button"
          role="switch"
          aria-checked={running}
          aria-label={running ? "Turn the click off" : `Turn the click on at ${bpm} BPM`}
          onClick={() => {
            if (running) {
              stop();
            } else {
              prime();
              start(bpm, beatsPerBar);
            }
          }}
          className="transition-transform active:scale-95"
          style={{
            minHeight: 44,
            padding: "0 16px",
            borderRadius: 9999,
            background: running ? "var(--cog-gold)" : "transparent",
            border: running ? "1px solid var(--cog-gold)" : "1px solid var(--cog-border-gold)",
            color: running ? "var(--cog-cream-light)" : "var(--cog-gold)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {`Click · ${bpm}`}
        </button>

        {/* "I'm on earbuds" — the explicit confirmation that unlocks audible
            monitoring while recording. Never assumed; honest when off. */}
        <button
          type="button"
          role="switch"
          aria-checked={headphonesConfirmed}
          aria-label={
            headphonesConfirmed
              ? "On earbuds — click can sound while recording"
              : "I'm on earbuds — let the click sound while recording"
          }
          onClick={() => setHeadphones(!headphonesConfirmed)}
          className="transition-transform active:scale-95"
          style={{
            minWidth: 44,
            minHeight: 44,
            padding: "0 12px",
            borderRadius: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            background: headphonesConfirmed ? "var(--cog-gold-pale)" : "transparent",
            border: "1px solid var(--cog-border-gold)",
            color: headphonesConfirmed ? "var(--cog-charcoal)" : "var(--cog-warm-gray)",
            fontFamily: "var(--font-body)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Headphones size={14} strokeWidth={2} />
          {headphonesConfirmed ? "Earbuds" : "Earbuds?"}
        </button>
      </div>
    </div>
  );
};

export default MetronomeStrip;
