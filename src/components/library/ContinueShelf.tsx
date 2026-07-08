import { ArrowRight, Mic } from "lucide-react";
import type { SongCard as SongRow } from "@/types";
import { relativeDate, coverColor } from "@/lib/library/format";

/**
 * ContinueShelf — "Pick up where you left off" (PV11: prioritize the last
 * active song; last-edited labels create obvious re-entry points). One wide
 * hero card for the most recently edited song, so a returning songwriter is
 * one tap from the room that needs them.
 */
const ContinueShelf = ({ song, onOpen }: { song: SongRow; onOpen: () => void }) => (
  <div className="mb-4">
    <p
      className="mb-2 px-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em]"
      style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
    >
      Pick up where you left off
    </p>
    <button
      onClick={onOpen}
      aria-label={`Continue ${song.title}, last edited ${relativeDate(song.last_activity_at)}`}
      className="group flex w-full items-center gap-3.5 rounded-2xl bg-white p-4 text-left transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-16px_rgba(184,149,58,0.35)] active:scale-[0.98]"
      style={{
        border: "1px solid var(--cog-border-gold)",
        boxShadow: "0 4px 16px -8px rgba(184,149,58,0.25)",
      }}
    >
      <div
        aria-hidden
        className="shrink-0 rounded-xl"
        style={{
          width: 52,
          height: 52,
          background: `linear-gradient(135deg, ${coverColor(song.cover_color)}, var(--cog-cream-dark))`,
          border: "1px solid var(--cog-border)",
        }}
      />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[1.0625rem] font-bold leading-snug text-[var(--cog-charcoal)] transition-colors duration-200 group-hover:text-[var(--cog-gold)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {song.title}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <Mic size={11} style={{ color: "var(--cog-gold)" }} />
          <span className="truncate text-[0.75rem]" style={{ color: "var(--cog-muted)" }}>
            {song.voice_memo_count} {song.voice_memo_count === 1 ? "idea" : "ideas"} · last
            edited {relativeDate(song.last_activity_at)}
          </span>
        </div>
      </div>
      <div
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5"
        style={{ backgroundColor: "var(--cog-gold-pale)", color: "var(--cog-gold)" }}
      >
        <ArrowRight size={16} strokeWidth={2.2} />
      </div>
    </button>
  </div>
);

export default ContinueShelf;
