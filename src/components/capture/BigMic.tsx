import { useEffect, useRef } from "react";
import { Mic, Square } from "lucide-react";
import { formatDurationLive } from "@/lib/voice/audioFormat";
import type { RecorderPhase } from "@/hooks/useVoiceRecorder";

interface BigMicProps {
  phase: RecorderPhase;
  durationMs: number;
  analyser: AnalyserNode | null;
  onTap: () => void;
  /**
   * Deprecated hold-to-hum handlers — intentionally unused. The primary mic is
   * tap-to-start / tap-to-stop (iOS Voice Memos standard) for reliability and
   * keyboard accessibility; mixing a press-and-hold gesture on the same target
   * races with the tap and orphans recordings. Hold-to-hum lives in its own
   * Canvas feature (F9 Instant Hum Capture). Props kept optional for compat.
   */
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  humMode?: boolean;
}

/**
 * Adobe Podcast-style mic: a big centered gold pill that ripples while
 * recording and shows a live amplitude ring around the glyph.
 *
 * Single, unambiguous interaction: tap to start, tap to stop. Works with mouse,
 * touch, and keyboard (Enter/Space) because it's a plain button click.
 * Respects prefers-reduced-motion: ripple + amplitude fall back to a static ring.
 */
const BigMic = ({ phase, durationMs, analyser, onTap }: BigMicProps) => {
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const recording = phase === "recording";
  const busy = phase === "requesting-permission" || phase === "stopping";
  // The brief getUserMedia wait on a cold first tap. A calm pulsing ring here
  // confirms "we heard you — arming the mic" so the moment feels instant instead
  // of frozen, without a spinner (reverent, not busy-looking).
  const arming = phase === "requesting-permission";
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Drive the amplitude ring from the analyser node.
  useEffect(() => {
    if (!analyser || !ringRef.current || reduceMotion) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length); // 0..1
      const scale = 1 + Math.min(rms * 1.4, 0.35);
      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${scale.toFixed(3)})`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (ringRef.current) ringRef.current.style.transform = "scale(1)";
    };
  }, [analyser, reduceMotion]);

  return (
    <div className="flex flex-col items-center" style={{ gap: 24 }}>
      <div className="relative" style={{ width: 220, height: 220 }}>
        {/* Outer ripple — only while recording, only when motion is allowed */}
        {recording && !reduceMotion && (
          <>
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: "var(--cog-gold)",
                opacity: 0.18,
                animation: "cog-mic-ripple 1.6s ease-out infinite",
                // Decorative only — must never swallow the tap meant for the mic.
                pointerEvents: "none",
              }}
            />
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: "var(--cog-gold)",
                opacity: 0.12,
                animation: "cog-mic-ripple 1.6s ease-out infinite 0.5s",
                pointerEvents: "none",
              }}
            />
          </>
        )}

        {/* Arming pulse — while the mic is being requested (cold first tap), a
            single gentle ring breathes so the tap feels acknowledged instantly.
            Reduced-motion users get the static amplitude ring below instead. */}
        {arming && !reduceMotion && (
          <span
            aria-hidden
            className="absolute rounded-full"
            style={{
              inset: 24,
              border: "2px solid var(--cog-gold)",
              animation: "cog-mic-arming 1.05s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Amplitude ring (driven by analyser) */}
        <div
          ref={ringRef}
          aria-hidden
          className="absolute rounded-full"
          style={{
            inset: 24,
            border: "2px solid rgba(184,149,58,0.45)",
            transition: "transform 80ms linear",
            // The amplitude ring overlaps the button box — without this it could
            // intercept the tap. Decorative, so it never receives pointer events.
            pointerEvents: "none",
          }}
        />

        {/* The mic button — single tap target, start/stop toggle. */}
        <button
          type="button"
          onClick={onTap}
          disabled={busy}
          aria-pressed={recording}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className="absolute rounded-full flex items-center justify-center transition-transform active:scale-95"
          style={{
            inset: 40,
            background: "linear-gradient(135deg, var(--cog-gold), var(--cog-gold-light, #d4ae5c))",
            color: "var(--cog-cream-light, #faf7f2)",
            boxShadow:
              "0 18px 48px rgba(184,149,58,0.42), inset 0 1px 0 rgba(255,255,255,0.35)",
            border: "none",
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.85 : 1,
          }}
        >
          {recording ? (
            <Square size={48} strokeWidth={2} fill="currentColor" />
          ) : (
            <Mic size={56} strokeWidth={1.8} />
          )}
        </button>
      </div>

      <div className="flex flex-col items-center" style={{ gap: 4 }}>
        <p
          // The ticking timer must NOT be a live region — it would spam a screen
          // reader with a new number every 100ms. The status line below carries
          // the announceable state.
          aria-live="off"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 36,
            fontVariantNumeric: "tabular-nums",
            color: recording ? "var(--cog-gold)" : "var(--cog-charcoal)",
            lineHeight: 1,
            margin: 0,
          }}
        >
          {formatDurationLive(durationMs)}
        </p>
        <p
          // Phase changes (starting → recording → saving) ARE announced here.
          aria-live="polite"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--cog-warm-gray, #6b6459)",
            margin: 0,
            letterSpacing: "0.02em",
            textAlign: "center",
          }}
        >
          {phase === "permission-denied"
            ? "Microphone access blocked — enable in Settings"
            : phase === "requesting-permission"
              ? "Starting the mic…"
              : phase === "stopping"
                ? "Saving your idea…"
                : recording
                  ? "Tap to stop · say “Verse” or “Chorus” to split"
                  : "Tap to record"}
        </p>
      </div>

      {/* Scoped keyframe for the arming pulse — kept here so BigMic owns its own
          motion without touching global CSS. */}
      <style>{`
        @keyframes cog-mic-arming {
          0%   { transform: scale(1);    opacity: 0.55; }
          50%  { transform: scale(1.05); opacity: 0.9; }
          100% { transform: scale(1);    opacity: 0.55; }
        }
      `}</style>
    </div>
  );
};

export default BigMic;
