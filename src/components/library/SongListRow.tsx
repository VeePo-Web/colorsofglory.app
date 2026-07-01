import { ChevronRight } from "lucide-react";
import type { SongCard as SongRow } from "@/integrations/cog/songs";
import { relativeDate, coverColor } from "@/lib/library/format";

interface SongListRowProps {
  song: SongRow;
  onClick: () => void;
}

/**
 * SongListRow — the Apple Music Library row: cover art analog on the left,
 * serif title, quiet one-line meta, trailing chevron. Built for fast vertical
 * scanning of a large catalog.
 */
const SongListRow = ({ song, onClick }: SongListRowProps) => {
  const meta = [
    `${song.voice_memo_count} ${song.voice_memo_count === 1 ? "idea" : "ideas"}`,
    song.collaborator_count > 1 ? `${song.collaborator_count} people` : "Just you",
    relativeDate(song.last_activity_at),
  ].join(" · ");

  return (
    <button
      onClick={onClick}
      aria-label={`Open ${song.title}, ${meta}`}
      className="group flex w-full items-center gap-3 rounded-2xl bg-white border border-[var(--cog-border)] p-3 text-left shadow-[0_1px_4px_rgba(28,26,23,0.05)] transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-0.5 hover:border-[var(--cog-border-gold)] hover:shadow-[0_10px_24px_-14px_rgba(184,149,58,0.30)] active:scale-[0.98]"
      style={{ minHeight: 68 }}
    >
      {/* Cover swatch */}
      <div
        aria-hidden
        className="shrink-0 rounded-xl"
        style={{
          width: 44,
          height: 44,
          background: `linear-gradient(135deg, ${coverColor(song.cover_color)}, var(--cog-cream-dark))`,
          border: "1px solid var(--cog-border)",
        }}
      />

      <div className="min-w-0 flex-1">
        <p
          className="truncate font-bold text-[0.9375rem] leading-snug text-[var(--cog-charcoal)] transition-colors duration-200 group-hover:text-[var(--cog-gold)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {song.title}
        </p>
        <p className="truncate text-[0.75rem] mt-0.5" style={{ color: "var(--cog-muted)" }}>
          {meta}
        </p>
      </div>

      <ChevronRight
        size={16}
        className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
        style={{ color: "var(--cog-muted)" }}
      />
    </button>
  );
};

export default SongListRow;
