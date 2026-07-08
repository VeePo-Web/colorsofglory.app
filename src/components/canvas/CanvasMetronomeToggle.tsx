import { Minus, Plus } from "lucide-react";
import type { CanvasMetronomeApi } from "@/lib/canvas/features/useCanvasMetronome";
import { usePrefersReducedMotion } from "@/lib/canvas/features/usePrefersReducedMotion";

/**
 * CanvasMetronomeToggle — F14, one tap starts/stops the click.
 *
 * Renders the beat dots driven by the engine's onBeat clock (via
 * useCanvasMetronome) so the pulse and the sound always agree; the downbeat
 * dot is gold. BPM steppers appear while running; changes persist to the song.
 */
const CanvasMetronomeToggle = ({ metronome }: { metronome: CanvasMetronomeApi }) => {
  const { running, bpm, beat, beatsPerBar, toggle, setBpm } = metronome;
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      role="group"
      aria-label="Metronome"
      style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}
    >
      {running && (
        <button
          type="button"
          onClick={() => setBpm(bpm - 2)}
          aria-label="Slow the metronome down"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid rgba(28,26,23,0.10)",
            backgroundColor: "#FFFFFF",
            color: "var(--cog-warm-gray, #6B6459)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Minus size={12} strokeWidth={2.5} />
        </button>
      )}

      <button
        type="button"
        onClick={() => void toggle()}
        aria-pressed={running}
        aria-label={running ? `Stop metronome, ${bpm} BPM` : `Start metronome, ${bpm} BPM`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          minHeight: 32,
          padding: "0 12px",
          borderRadius: 999,
          border: running
            ? "1px solid rgba(184,149,58,0.40)"
            : "1px solid rgba(28,26,23,0.10)",
          backgroundColor: running ? "rgba(184,149,58,0.10)" : "#FFFFFF",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          fontSize: 11,
          fontWeight: 700,
          color: running ? "var(--cog-gold, #B8953A)" : "var(--cog-warm-gray, #6B6459)",
          transition: reducedMotion ? "none" : "background-color 150ms ease, color 150ms ease",
        }}
      >
        {/* Beat dots — driven off the engine clock */}
        <span aria-hidden="true" style={{ display: "flex", gap: 3 }}>
          {Array.from({ length: beatsPerBar }, (_, i) => {
            const active = running && beat === i;
            return (
              <span
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: active
                    ? i === 0
                      ? "var(--cog-gold, #B8953A)"
                      : "var(--cog-charcoal, #1C1A17)"
                    : "rgba(28,26,23,0.18)",
                  transform: active && !reducedMotion ? "scale(1.5)" : "scale(1)",
                  transition: reducedMotion
                    ? "none"
                    : "transform 80ms ease, background-color 80ms ease",
                }}
              />
            );
          })}
        </span>
        {bpm} BPM
      </button>

      {running && (
        <button
          type="button"
          onClick={() => setBpm(bpm + 2)}
          aria-label="Speed the metronome up"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid rgba(28,26,23,0.10)",
            backgroundColor: "#FFFFFF",
            color: "var(--cog-warm-gray, #6B6459)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Plus size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};

export default CanvasMetronomeToggle;
