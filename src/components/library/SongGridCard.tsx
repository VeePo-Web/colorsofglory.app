import { Mic, Pin, Check } from "lucide-react";
import type { SongCard as SongRow } from "@/types";
import { relativeDate, coverColor } from "@/lib/library/format";
import { songStatusChip } from "@/lib/library/songStatus";
import { useLongPress } from "./useLongPress";
import StatusChip from "./StatusChip";

interface SongGridCardProps {
  song: SongRow;
  /** Compact = the denser 3-across grid (Apple Photos pinched-in). */
  compact?: boolean;
  onClick: () => void;
  /** Press-and-hold (or right-click) → the song's contextual actions. */
  onLongPress?: () => void;
  /** Held at the top of the library (Apple Notes). */
  pinned?: boolean;
  /** Batch-select mode active (Apple Photos): tap toggles instead of opens. */
  selecting?: boolean;
  selected?: boolean;
}

/**
 * SongGridCard — one song as a tactile creative room (never a file tile).
 * Two densities: comfortable (2-across) shows the full room; compact
 * (3-across) keeps title + ideas so more of the catalog fits one glance.
 */
const SongGridCard = ({
  song,
  compact = false,
  onClick,
  onLongPress,
  pinned = false,
  selecting = false,
  selected = false,
}: SongGridCardProps) => (
  <button
    onClick={onClick}
    {...(selecting ? {} : useLongPress(onLongPress))}
    aria-label={
      selecting
        ? `${selected ? "Deselect" : "Select"} ${song.title}`
        : `Open ${song.title}, ${song.voice_memo_count} ${
            song.voice_memo_count === 1 ? "idea" : "ideas"
          }, last edited ${relativeDate(song.last_activity_at)}`
    }
    aria-pressed={selecting ? selected : undefined}
    className="group relative text-left w-full select-none rounded-2xl flex flex-col justify-between bg-white border border-[var(--cog-border)] shadow-[0_2px_8px_rgba(28,26,23,0.06)] transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1 hover:border-[var(--cog-border-gold)] hover:shadow-[0_16px_32px_-16px_rgba(184,149,58,0.32)] active:scale-[0.97]"
    style={{
      minHeight: compact ? 104 : 140,
      padding: compact ? 12 : 16,
      WebkitTouchCallout: "none",
      // Selected ring overrides the border utility while batch-selecting.
      ...(selected ? { border: "1.5px solid var(--cog-gold)" } : null),
    }}
  >
    {selecting && (
      <span
        aria-hidden
        className="absolute right-2 top-2 z-10 flex items-center justify-center rounded-full transition-all duration-150"
        style={{
          width: 22,
          height: 22,
          backgroundColor: selected ? "var(--cog-gold)" : "rgba(255,255,255,0.9)",
          border: selected ? "none" : "1.5px solid var(--cog-muted)",
          boxShadow: "0 1px 3px rgba(28,26,23,0.15)",
        }}
      >
        {selected && <Check size={13} strokeWidth={3} color="white" />}
      </span>
    )}
    <div className="w-full">
      {/* Cover swatch + calm status chip (PV11: Active · Collaborating · Draft) */}
      <div className="mb-2.5 flex w-full items-start justify-between">
        <div
          aria-hidden
          className="rounded-lg"
          style={{
            width: compact ? 18 : 26,
            height: compact ? 18 : 26,
            background: `linear-gradient(135deg, ${coverColor(song.cover_color)}, var(--cog-cream-dark))`,
            border: "1px solid var(--cog-border)",
          }}
        />
        <span className="flex items-center gap-1.5" style={{ opacity: selecting ? 0 : 1 }}>
          {pinned && (
            <Pin
              size={compact ? 10 : 12}
              strokeWidth={2.2}
              fill="var(--cog-gold)"
              style={{ color: "var(--cog-gold)" }}
              aria-label="Pinned"
            />
          )}
          {!compact && <StatusChip spec={songStatusChip(song)} />}
        </span>
      </div>

      <p
        className={`font-bold leading-snug text-[var(--cog-charcoal)] transition-colors duration-200 group-hover:text-[var(--cog-gold)] ${
          compact ? "text-[0.8125rem] mb-1 line-clamp-2" : "text-[0.9375rem] mb-2"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {song.title}
      </p>

      <div className="flex items-center gap-1.5">
        <Mic size={compact ? 10 : 11} style={{ color: "var(--cog-gold)" }} />
        <span
          className={`font-medium ${compact ? "text-[0.6875rem]" : "text-[0.75rem]"}`}
          style={{ color: "var(--cog-muted)" }}
        >
          {song.voice_memo_count} {song.voice_memo_count === 1 ? "idea" : "ideas"}
        </span>
      </div>
    </div>

    {!compact && (
      <div className="flex w-full items-end justify-between mt-3">
        <span className="text-[0.6875rem]" style={{ color: "var(--cog-muted)" }}>
          {song.collaborator_count > 1 ? `${song.collaborator_count} people` : "Just you"}
        </span>
        <p className="text-[0.6875rem]" style={{ color: "var(--cog-muted)" }}>
          {relativeDate(song.last_activity_at)}
        </p>
      </div>
    )}
  </button>
);

export default SongGridCard;
