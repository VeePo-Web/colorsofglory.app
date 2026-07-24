import { Minus, Plus } from "lucide-react";
import TapTempo from "./TapTempo";
import { useVibration } from "@/hooks/useVibration";

interface MetronomeBarProps {
  /** Current BPM, or null until the songwriter sets one. */
  bpm: number | null;
  /** Whether a count-in + click plays when recording starts. */
  clickOn: boolean;
  onBpmChange: (bpm: number) => void;
  onClickToggle: (on: boolean) => void;
  className?: string;
}

const MIN_BPM = 40;
const MAX_BPM = 240;

/**
 * MetronomeBar — the "hum it in time" control on the Capture scene.
 *
 * Tap-tempo sets the BPM by feel (no typing), ± nudges fine-tune it, and the
 * Click toggle decides whether a 4-beat count-in + steady click plays when the
 * take starts. Calm, thumb-reachable, ≥44px targets — it sits quietly under the
 * mic and only matters to people who want it.
 */
const MetronomeBar = ({
  bpm,
  clickOn,
  onBpmChange,
  onClickToggle,
  className,
}: MetronomeBarProps) => {
  const { vibrate } = useVibration();
  const effectiveBpm = bpm ?? 90;

  const nudge = (delta: number) => {
    const next = Math.min(MAX_BPM, Math.max(MIN_BPM, effectiveBpm + delta));
    vibrate(4);
    onBpmChange(next);
  };

  return (
    <div
      className={`flex items-center justify-center gap-2 ${className ?? ""}`}
      style={{ flexWrap: "wrap" }}
    >
      <TapTempo onBpm={onBpmChange} />

      {/* ± nudge — the BPM readout + fine-tune. Its space is RESERVED even
          before a tempo exists (visibility, not conditional render), so tapping
          Tap tempo can never re-center the row and slide the button out from
          under the thumb mid-rhythm. It's the single source of the number. */}
      <div
        className="flex items-center"
        aria-hidden={bpm == null}
        style={{
          gap: 2,
          borderRadius: 9999,
          background: "rgba(184,149,58,0.10)",
          border: "1px solid rgba(184,149,58,0.25)",
          visibility: bpm != null ? "visible" : "hidden",
        }}
      >
        <button
          type="button"
          aria-label="Decrease BPM"
          tabIndex={bpm == null ? -1 : 0}
          onClick={() => nudge(-1)}
          className="flex items-center justify-center transition-transform active:scale-90"
          style={{ width: 44, height: 44, color: "var(--cog-warm-gray)", background: "transparent", border: "none", cursor: "pointer" }}
        >
          <Minus size={15} />
        </button>
        <span
          aria-live="polite"
          style={{ minWidth: 46, textAlign: "center", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "var(--cog-charcoal)" }}
        >
          {bpm ?? ""}
        </span>
        <button
          type="button"
          aria-label="Increase BPM"
          tabIndex={bpm == null ? -1 : 0}
          onClick={() => nudge(1)}
          className="flex items-center justify-center transition-transform active:scale-90"
          style={{ width: 44, height: 44, color: "var(--cog-warm-gray)", background: "transparent", border: "none", cursor: "pointer" }}
        >
          <Plus size={15} />
        </button>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={clickOn}
        aria-label="Count-in and click while recording"
        onClick={() => { vibrate(5); onClickToggle(!clickOn); }}
        className="flex items-center justify-center gap-1.5 transition-transform active:scale-95"
        style={{
          // Width fits the longer "Count-in on" label so toggling never resizes
          // the button and nudges the row — the tempo controls stay put.
          minWidth: 112,
          minHeight: 44,
          padding: "0 14px",
          borderRadius: 9999,
          background: clickOn ? "var(--cog-gold)" : "transparent",
          border: clickOn ? "1px solid var(--cog-gold)" : "1px solid rgba(184,149,58,0.30)",
          color: clickOn ? "var(--cog-cream-light, #faf7f2)" : "var(--cog-gold)",
          fontFamily: "var(--font-body)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {clickOn ? "Count-in on" : "Count-in"}
      </button>
    </div>
  );
};

export default MetronomeBar;
