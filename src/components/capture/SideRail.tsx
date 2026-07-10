import { useState } from "react";
import { PenLine, Music, Bookmark, BookOpen, Lightbulb, type LucideIcon } from "lucide-react";
import { GLORY, GLORY_PALE_GOLD, type GloryTone } from "@/lib/canvas/glorySpectrum";

export type RailAction = "lyrics" | "chords" | "section" | "scripture" | "note";

interface SideRailProps {
  recording: boolean;
  onAction: (action: RailAction) => void;
}

// The auth-code's ROYGBV power-up, standing as a column: each chip wears the
// SAME glory tone its card will wear on the song canvas — the color language
// travels with the idea from the moment it's captured. Top to bottom the rail
// reads as a warm spectrum: rose → pale gold → gold → sage → violet.
const CHIPS: Array<{ id: RailAction; label: string; icon: LucideIcon; tone: GloryTone }> = [
  { id: "lyrics", label: "Lyrics", icon: PenLine, tone: GLORY.crimson },
  { id: "chords", label: "Chords", icon: Music, tone: GLORY_PALE_GOLD },
  { id: "section", label: "Section", icon: Bookmark, tone: GLORY.gold },
  { id: "scripture", label: "Scripture", icon: BookOpen, tone: GLORY.sage },
  { id: "note", label: "Idea", icon: Lightbulb, tone: GLORY.violet },
];

/**
 * Adobe-style edge rail: a vertical column of labeled chips pinned to the
 * right edge of the viewport, vertically centered against the mic.
 *
 * - Idle: quiet cream chips, each tinted by its glory tone.
 * - Recording: the rail POWERS UP — every chip glows in its own jewel tone
 *   (the 6-digit auth code's cell glow, standing in a column) so the live
 *   take is visibly surrounded by everything it can become.
 * - Tap during a recording → drops a timestamped pin and the chip lands with
 *   the auth code's success pop (tint deepens, glow blooms, 1.09 scale beat).
 *   Reduced-motion drops the pop — the colors stay (color isn't motion).
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
      }, 420);
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
        const { tone } = chip;
        const isFlashed = flashed === chip.id;
        // Three registers, straight from the OTP cell recipe:
        //   idle      → white chip, whisper of the tone in icon + border
        //   powered   → tone tint bg + tone border + soft tone glow (recording)
        //   landed    → deeper tint + full-power glow + pop (pin confirmed)
        const background = isFlashed
          ? `${tone.base}1F`
          : recording
            ? tone.bg
            : "var(--cog-cream-light, #faf7f2)";
        const border = isFlashed
          ? `1.5px solid ${tone.base}`
          : recording
            ? `1.5px solid ${tone.base}59`
            : `1px solid ${tone.base}2E`;
        const boxShadow = isFlashed
          ? `0 0 0 3px ${tone.base}33, 0 6px 18px ${tone.base}4D`
          : recording
            ? `0 0 0 3px ${tone.base}26, 0 4px 14px ${tone.base}33`
            : "0 2px 8px rgba(28,26,23,0.08)";
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
              background,
              border,
              cursor: "pointer",
              color: tone.dark,
              boxShadow,
              transition:
                "background 200ms ease, color 200ms ease, border-color 200ms ease, box-shadow 240ms ease, transform 120ms ease",
              // One inline animation slot: the landing POP while flashed, the
              // staggered slide-in on mount, nothing under reduced-motion
              // (the colors stay — color isn't motion).
              animation: reduceMotion
                ? "none"
                : isFlashed
                  ? "cogRailPop 240ms cubic-bezier(0.34, 1.56, 0.64, 1)"
                  : `cog-rail-enter 320ms var(--cog-ease-reveal, cubic-bezier(0.22,1,0.36,1)) ${idx * 40}ms both`,
            }}
            aria-label={
              recording
                ? `Pin ${chip.label.toLowerCase()} at current moment`
                : `Open ${chip.label.toLowerCase()}`
            }
          >
            <Icon size={20} strokeWidth={1.7} style={{ color: tone.base }} />
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
        /* The auth code's power-up pop — a pinned moment LANDS. */
        @keyframes cogRailPop {
          0%   { transform: scale(1); }
          45%  { transform: scale(1.09); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default SideRail;
