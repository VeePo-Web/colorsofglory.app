import { useEffect, useState } from "react";

interface BeatPulseProps {
  /** 0-indexed beat that just landed (audio-clock-driven), or null when idle. */
  beatInBar: number | null;
  beatsPerBar: number;
  /**
   * "primary" elevates the pulse into the PRIMARY tempo reference — larger and
   * brighter, because during a speaker recording it is all the songwriter has.
   */
  emphasis: "primary" | "quiet";
}

/**
 * BeatPulse — the visual metronome. A calm row of gold beat dots; the landing
 * beat swells, the downbeat carries more weight. Driven exclusively by the
 * engine's onBeat events, which ride the Web Audio clock — never a separate
 * timer, so the pulse can not drift from the (possibly silent) click.
 *
 * Reduced motion: the swell becomes a plain opacity/color step, still clearly
 * legible as a beat, with no scale animation.
 */
const BeatPulse = ({ beatInBar, beatsPerBar, emphasis }: BeatPulseProps) => {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const active = beatInBar ?? -1;
  const primary = emphasis === "primary";
  const dot = primary ? 14 : 9;
  const downbeatDot = primary ? 18 : 11;

  return (
    <div
      role="img"
      aria-label={active >= 0 ? `Beat ${active + 1} of ${beatsPerBar}` : "Metronome ready"}
      style={{ display: "flex", alignItems: "center", gap: primary ? 14 : 10 }}
    >
      {Array.from({ length: Math.max(1, beatsPerBar) }, (_, i) => {
        const isActive = i === active;
        const isDownbeat = i === 0;
        const size = isDownbeat ? downbeatDot : dot;
        return (
          <span
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: isActive ? "var(--cog-gold)" : "var(--cog-gold-pale)",
              opacity: isActive ? 1 : 0.45,
              transform:
                !reducedMotion && isActive ? `scale(${primary ? 1.35 : 1.25})` : "scale(1)",
              boxShadow: isActive && primary ? "0 0 12px var(--cog-gold-glow)" : "none",
              transition: reducedMotion
                ? "opacity 60ms linear, background-color 60ms linear"
                : "transform 90ms var(--cog-ease, ease-out), opacity 90ms linear, background-color 90ms linear",
            }}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
};

export default BeatPulse;
