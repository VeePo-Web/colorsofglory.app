import { ChevronLeft, Pencil, Disc3, Plus, ArrowUpDown, Check, Repeat } from "lucide-react";
import type { SongCard as SongRow } from "@/integrations/cog/songs";
import type { SongAlbum } from "@/lib/library/albums";
import { coverColor } from "@/lib/library/format";

interface AlbumDetailHeaderProps {
  album: SongAlbum;
  songs: SongRow[];
  onExit: () => void;
  onEdit: () => void;
  onAddSongs: () => void;
  /** Loop the whole album in the car. Shown only when a song has an idea to play. */
  onPractice?: () => void;
  /** Tracklist arrange-mode toggle (shown only when 2+ songs). */
  reordering?: boolean;
  onToggleReorder?: () => void;
}

const FALLBACKS = [
  "var(--cog-gold-pale)",
  "var(--cog-cream-dark)",
  "var(--cog-gold-light)",
  "var(--cog-cream)",
];

/**
 * AlbumDetailHeader — the Apple Music "inside a playlist" surface. When an
 * album is focused, this replaces the shelf so the songwriter always knows
 * which album they're in (title + counts + cover never leaves), can get back
 * to all songs in one tap, and can act on the album as a whole. Removes the
 * "which album am I in / how do I leave" friction of a scroll-away shelf.
 */
const AlbumDetailHeader = ({
  album,
  songs,
  onExit,
  onEdit,
  onAddSongs,
  onPractice,
  reordering = false,
  onToggleReorder,
}: AlbumDetailHeaderProps) => {
  const covers = songs.slice(0, 4).map((s) => coverColor(s.cover_color));
  const ideas = songs.reduce((n, s) => n + s.voice_memo_count, 0);
  const empty = songs.length === 0;

  return (
    <div className="mb-4">
      {/* Back to all songs · Reorder toggle (Apple "Edit" affordance) */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center gap-1 transition-transform duration-150 active:scale-95"
          style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)", minHeight: 44 }}
          aria-label="Back to all songs"
        >
          <ChevronLeft size={18} strokeWidth={2.2} />
          <span className="text-[0.875rem] font-semibold">All songs</span>
        </button>
        {songs.length > 1 && onToggleReorder && (
          <button
            onClick={onToggleReorder}
            className="flex items-center gap-1.5 transition-transform duration-150 active:scale-95"
            style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)", minHeight: 44 }}
            aria-pressed={reordering}
          >
            {reordering ? <Check size={16} strokeWidth={2.4} /> : <ArrowUpDown size={15} strokeWidth={2.2} />}
            <span className="text-[0.875rem] font-semibold">{reordering ? "Done" : "Reorder"}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Mosaic cover */}
        <div
          aria-hidden
          className="grid h-[92px] w-[92px] shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded-2xl"
          style={{ border: "1px solid var(--cog-border)", boxShadow: "0 8px 22px -10px rgba(28,26,23,0.28)" }}
        >
          {empty ? (
            <div
              className="col-span-2 row-span-2 flex items-center justify-center"
              style={{ backgroundColor: "var(--cog-gold-pale)" }}
            >
              <Disc3 size={30} strokeWidth={1.5} style={{ color: "var(--cog-gold)" }} />
            </div>
          ) : (
            Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                style={{ background: `linear-gradient(135deg, ${covers[i] ?? FALLBACKS[i]}, var(--cog-cream-dark))` }}
              />
            ))
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-[1.375rem] font-bold leading-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)" }}
          >
            {album.name}
          </h2>
          <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}>
            {songs.length} {songs.length === 1 ? "song" : "songs"}
            {ideas > 0 && ` · ${ideas} ${ideas === 1 ? "idea" : "ideas"}`}
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 transition-transform duration-150 active:scale-95"
              style={{
                minHeight: 36,
                backgroundColor: "var(--cog-cream-dark)",
                color: "var(--cog-charcoal)",
                fontFamily: "var(--font-body)",
                fontSize: "0.8125rem",
                fontWeight: 600,
              }}
            >
              <Pencil size={13} strokeWidth={2} />
              Edit
            </button>
            <button
              onClick={onAddSongs}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 transition-transform duration-150 active:scale-95"
              style={{
                minHeight: 36,
                backgroundColor: "var(--cog-gold-pale)",
                color: "var(--cog-gold)",
                fontFamily: "var(--font-body)",
                fontSize: "0.8125rem",
                fontWeight: 700,
              }}
            >
              <Plus size={14} strokeWidth={2.4} />
              Add songs
            </button>
          </div>
        </div>
      </div>

      {/* Practice the whole album — loop every idea, hands-free, in the car */}
      {onPractice && ideas > 0 && (
        <button
          onClick={onPractice}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl transition-transform duration-150 active:scale-[0.98]"
          style={{
            minHeight: 52,
            backgroundColor: "var(--cog-gold)",
            color: "#fff",
            fontFamily: "var(--font-body)",
            fontSize: "0.9375rem",
            fontWeight: 700,
            border: "none",
            boxShadow: "0 10px 24px -12px rgba(184,149,58,0.65)",
          }}
          aria-label={`Practice ${album.name} — loop every idea`}
        >
          <Repeat size={17} strokeWidth={2.4} />
          Practice album
        </button>
      )}
    </div>
  );
};

export default AlbumDetailHeader;
