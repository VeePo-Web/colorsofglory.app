import { useEffect, useRef } from "react";
import { Mic, Square } from "lucide-react";
import { formatDurationLive } from "@/lib/voice/audioFormat";
import type { RecorderPhase } from "@/hooks/useVoiceRecorder";

interface BigMicProps {
  phase: RecorderPhase;
  durationMs: number;
  analyser: AnalyserNode | null;
  onTap: () => void;
  /** Hold-to-record: press starts, release stops. */
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  /** When true, the current take started via hold-to-hum. Changes the label. */
  humMode?: boolean;
}

/**
 * Adobe Podcast-style mic: a big centered gold pill that ripples while
 * recording and shows a live amplitude ring around the glyph.
 *
 * - Tap to start, tap to stop (long captures).
 * - Hold to start, release to stop (quick hums) when handlers provided.
 * - Respects prefers-reduced-motion: ripple and amplitude fall back to a static ring.
 */
const BigMic = ({ phase, durationMs, analyser, onTap, onHoldStart, onHoldEnd, humMode }: BigMicProps) => {
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const recording = phase === "recording";
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

  const holdProps = onHoldStart
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          if (recording) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          onHoldStart();
        },
        onPointerUp: () => {
          if (recording) onHoldEnd?.();
        },
        onPointerCancel: () => {
          if (recording) onHoldEnd?.();
        },
      }
    : {};

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
              }}
            />
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{
                background: "var(--cog-gold)",
                opacity: 0.12,
                animation: "cog-mic-ripple 1.6s ease-out infinite 0.5s",
              }}
            />
          </>
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
          }}
        />

        {/* The mic button */}
        <button
          type="button"
          onClick={onTap}
          {...holdProps}
          aria-pressed={recording}
          aria-label={recording ? "Stop recording" : "Start recording"}
          className="absolute rounded-full flex items-center justify-center transition-transform active:scale-95"
          style={{
            inset: 40,
            background: recording
              ? "linear-gradient(135deg, var(--cog-gold), var(--cog-gold-light, #d4ae5c))"
              : "linear-gradient(135deg, var(--cog-gold), var(--cog-gold-light, #d4ae5c))",
            color: "var(--cog-cream-light, #faf7f2)",
            boxShadow:
              "0 18px 48px rgba(184,149,58,0.42), inset 0 1px 0 rgba(255,255,255,0.35)",
            border: "none",
            cursor: "pointer",
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
          aria-live="polite"
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
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--cog-warm-gray, #6b6459)",
            margin: 0,
            letterSpacing: "0.02em",
          }}
        >
          {phase === "permission-denied"
            ? "Microphone access blocked — enable in Settings"
            : phase === "requesting-permission"
              ? "Listening for permission…"
              : recording
                ? humMode
                  ? "Humming\u2026 release to save"
                  : "Tap to stop · say \u201cVerse 1\u201d or \u201cChorus\u201d to split"
                : onHoldStart
                  ? "Tap to record · or hold for a quick hum"
                  : "Tap to record"}
        </p>
      </div>
    </div>
  );
};

export default BigMic;