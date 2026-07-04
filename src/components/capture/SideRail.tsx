import { useState } from "react";
import { PenLine, Music, Bookmark, BookOpen, Lightbulb, type LucideIcon } from "lucide-react";

export type RailAction = "lyrics" | "chords" | "section" | "scripture" | "note";

interface SideRailProps {
  recording: boolean;
  onAction: (action: RailAction) => void;
}

const CHIPS: Array<{ id: RailAction; label: string; icon: LucideIcon }> = [
  { id: "lyrics", label: "Lyrics", icon: PenLine },
  { id: "chords", label: "Chords", icon: Music },
  { id: "section", label: "Section", icon: Bookmark },
  { id: "scripture", label: "Scripture", icon: BookOpen },
  { id: "note", label: "Idea", icon: Lightbulb },
];

/**
 * Adobe-style edge rail: a vertical column of labeled chips pinned to the
 * right edge of the viewport, vertically centered against the mic.
 *
 * - Idle tap → opens the matching capture sheet.
 * - Tap during a recording → drops a timestamped pin (handled by parent) and
 *   flashes the chip gold for ~300ms so the user sees confirmation without
 *   any modal interruption.
 */
const SideRail = ({ recording, onAction }: SideRailProps) => {
  const [flashed, setFlashed] = useState<RailAction | null>(null);
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const handleClick = (id: RailAction) => {
    onAction(id);
    if (recording) {
      setFlashed(id);
      window.setTimeout(() => {
        setFlashed((curr) => (curr === id ? null : curr));
      }, 320);
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Capture tools"
      className="flex flex-col"
      style={{
        position: "fixed",
        top: "50%",
        right: "max(12px, env(safe-area-inset-right))",
        transform: "translateY(-50%)",
        gap: 10,
        zIndex: 30,
        pointerEvents: "auto",
      }}
    >
      {CHIPS.map((chip, idx) => {
        const Icon = chip.icon;
        const isFlashed = flashed === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => handleClick(chip.id)}
            className="flex flex-col items-center justify-center transition-all active:scale-95"
            style={{
              width: 56,
              minHeight: 60,
              padding: "8px 4px",
              borderRadius: 16,
              background: isFlashed
                ? "var(--cog-gold)"
                : "var(--cog-cream-light, #faf7f2)",
              border: isFlashed
                ? "1px solid var(--cog-gold)"
                : recording
                  ? "1px solid rgba(184,149,58,0.40)"
                  : "1px solid rgba(28,26,23,0.08)",
              cursor: "pointer",
              color: isFlashed ? "var(--cog-cream-light, #faf7f2)" : "var(--cog-charcoal)",
              boxShadow: recording
                ? "0 4px 14px rgba(184,149,58,0.18), 0 0 0 1px rgba(184,149,58,0.10)"
                : "0 2px 8px rgba(28,26,23,0.08)",
              transition: "background 200ms ease, color 200ms ease, border-color 200ms ease, transform 120ms ease",
              // Staggered slide-in — suppressed for reduced-motion (chips just
              // appear, no travel), per the design bible's motion mandate.
              animation: reduceMotion
                ? "none"
                : `cog-rail-enter 320ms var(--cog-ease-reveal, cubic-bezier(0.22,1,0.36,1)) ${idx * 40}ms both`,
            }}
            aria-label={
              recording
                ? `Pin ${chip.label.toLowerCase()} at current moment`
                : `Open ${chip.label.toLowerCase()}`
            }
          >
            <Icon size={20} strokeWidth={1.7} />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 10,
                fontWeight: 600,
                marginTop: 3,
                letterSpacing: "0.04em",
              }}
            >
              {chip.label}
            </span>
          </button>
        );
      })}
      <style>{`
        @keyframes cog-rail-enter {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0);   }
        }
      `}</style>
    </div>
  );
};

export default SideRail;