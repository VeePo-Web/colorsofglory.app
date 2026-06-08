import { PenLine, Music, Bookmark, BookOpen, Lightbulb } from "lucide-react";

export type RailAction = "lyrics" | "chords" | "section" | "scripture" | "note";

interface SideRailProps {
  recording: boolean;
  onAction: (action: RailAction) => void;
}

const CHIPS: Array<{
  id: RailAction;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
}> = [
  { id: "lyrics", label: "Lyrics", icon: PenLine },
  { id: "chords", label: "Chords", icon: Music },
  { id: "section", label: "Section", icon: Bookmark },
  { id: "scripture", label: "Scripture", icon: BookOpen },
  { id: "note", label: "Idea", icon: Lightbulb },
];

/**
 * Always-labeled action rail. Tapping while recording inserts a timestamped pin;
 * tapping while idle opens that capture sheet (sheets are wired in Phase 1.5).
 */
const SideRail = ({ recording, onAction }: SideRailProps) => (
  <div
    role="toolbar"
    aria-label="Capture tools"
    className="grid grid-cols-5"
    style={{ gap: 8, width: "100%", maxWidth: 420 }}
  >
    {CHIPS.map((chip) => {
      const Icon = chip.icon;
      return (
        <button
          key={chip.id}
          type="button"
          onClick={() => onAction(chip.id)}
          className="flex flex-col items-center justify-center transition-transform active:scale-95"
          style={{
            padding: "10px 4px 8px",
            borderRadius: 14,
            background: "var(--cog-cream-light, #faf7f2)",
            border: "1px solid rgba(28,26,23,0.08)",
            cursor: "pointer",
            minHeight: 64,
            color: "var(--cog-charcoal)",
            boxShadow: recording
              ? "0 0 0 1px rgba(184,149,58,0.35), 0 4px 12px rgba(184,149,58,0.10)"
              : "0 2px 6px rgba(28,26,23,0.06)",
          }}
          aria-label={
            recording ? `Pin ${chip.label.toLowerCase()} at current moment` : `Open ${chip.label.toLowerCase()}`
          }
        >
          <Icon size={20} strokeWidth={1.6} />
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 11,
              fontWeight: 600,
              marginTop: 4,
              letterSpacing: "0.02em",
            }}
          >
            {chip.label}
          </span>
        </button>
      );
    })}
  </div>
);

export default SideRail;