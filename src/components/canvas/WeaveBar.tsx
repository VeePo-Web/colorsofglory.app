import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { GLORY } from "@/lib/canvas/glorySpectrum";
import { usePrefersReducedMotion } from "@/lib/canvas/features/usePrefersReducedMotion";

/**
 * WeaveBar — the calm floor of Weave mode (D1).
 *
 * One line of orientation (what's forming, how many lines placed), a jump
 * back to the forming section, and Done. No transport, no chips — weaving
 * happens on the cards; this bar only keeps the writer oriented and gives
 * the one guaranteed exit. Same fixed-bottom idiom as ListenPathBar.
 */

interface WeaveBarProps {
  sectionName: string;
  /** Total lines in the forming section (context for "tap to view"). */
  lineCount: number;
  /** Lines WOVEN into this section by Weave — the honest progress number. */
  placedCount: number;
  /** Idea cards with weavable lines. 0 → guide the writer, don't strand them. */
  candidateCount: number;
  onJumpToSection: () => void;
  onDone: () => void;
}

const WeaveBar = ({ sectionName, lineCount, placedCount, candidateCount, onJumpToSection, onDone }: WeaveBarProps) => {
  const [visible, setVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      role="toolbar"
      aria-label={`Weaving into ${sectionName}`}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 540,
        display: "flex",
        alignItems: "center",
        gap: 10,
        backgroundColor: "var(--cog-cream-light, #FAFAF6)",
        borderTop: `1px solid ${GLORY.gold.base}40`,
        boxShadow: `0 -8px 32px rgba(0,0,0,0.10), 0 -1px 0 ${GLORY.gold.base}26`,
        borderRadius: "20px 20px 0 0",
        padding: "12px 16px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: reducedMotion ? "none" : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <button
        type="button"
        onClick={onJumpToSection}
        aria-label={`Go to ${sectionName} — ${placedCount} woven in, ${lineCount} ${lineCount === 1 ? "line" : "lines"} total`}
        style={{
          flex: 1, minWidth: 0, minHeight: 44,
          display: "flex", alignItems: "center", gap: 9,
          padding: "0 6px", borderRadius: 12,
          background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            backgroundColor: GLORY.gold.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 0 3px ${GLORY.gold.base}1A`,
          }}
        >
          <Sparkles size={16} strokeWidth={1.8} style={{ color: GLORY.gold.base }} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: 700,
              color: "var(--cog-charcoal, #1C1A17)", lineHeight: 1.2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            Weaving · {sectionName}
          </span>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-body)", fontSize: 10.5, fontWeight: 600,
              color: "var(--cog-warm-gray, #6B6459)", marginTop: 1,
            }}
          >
            {candidateCount === 0
              ? "Write a few lyric ideas first — their lines will glow here"
              : placedCount === 0
                ? "Tap a glowing line to place it"
                : `${placedCount} woven in — tap to view`}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={onDone}
        style={{
          flexShrink: 0, minHeight: 44, padding: "0 20px", borderRadius: 12,
          backgroundColor: "var(--cog-gold, #B8953A)", border: "none", cursor: "pointer",
          fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "#FFF",
          boxShadow: "0 2px 10px rgba(184,149,58,0.35)",
        }}
        aria-label="Finish weaving"
      >
        Done
      </button>
    </div>
  );
};

export default WeaveBar;
