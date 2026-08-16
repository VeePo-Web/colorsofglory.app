import { useEffect, useRef, useState } from "react";
import { Pencil, Disc3, Plus, ArrowUpDown, Check, Repeat } from "lucide-react";
import type { SongCard as SongRow } from "@/integrations/cog/songs";
import type { SongAlbum } from "@/lib/library/albums";
import { albumColor } from "@/lib/library/albumColors";
import { coverColor } from "@/lib/library/format";
import Breadcrumb from "./Breadcrumb";

interface AlbumDetailHeaderProps {
  album: SongAlbum;
  songs: SongRow[];
  onExit: () => void;
  onEdit: () => void;
  onAddSongs: () => void;
  /** Rename in place — the name changes where the name lives (C4). */
  onRename?: (name: string) => void;
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
  onRename,
  onPractice,
  reordering = false,
  onToggleReorder,
}: AlbumDetailHeaderProps) => {
  const covers = songs.slice(0, 4).map((s) => coverColor(s.cover_color));
  const ideas = songs.reduce((n, s) => n + s.voice_memo_count, 0);
  const empty = songs.length === 0;
  // The album's chosen color wears the header cover too — the same "find the
  // red one" identity inside the album as on the shelf.
  const chosen = albumColor(album.color);

  // Rename where the name lives (C4): tap the title → it becomes an input in
  // the same serif at the same size. Enter/blur keeps it; Escape lets it go;
  // an emptied name quietly keeps the old one (a room is never nameless).
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(album.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editingName) nameInputRef.current?.select();
  }, [editingName]);
  const commitName = () => {
    setEditingName(false);
    const next = draft.trim();
    if (next && next !== album.name) onRename?.(next);
    else setDraft(album.name);
  };

  return (
    <div className="mb-4">
      {/* The breadcrumb — you always know where you are, and home is one tap.
          Reorder toggle keeps the right edge (Apple "Edit" affordance). */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <Breadcrumb root="All songs" onRoot={onExit} current={album.name} />
        {songs.length > 1 && onToggleReorder && (
          <button
            onClick={onToggleReorder}
            className="flex shrink-0 items-center gap-1.5 transition-transform duration-150 active:scale-95"
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
          {chosen ? (
            <div
              className="col-span-2 row-span-2 flex items-center justify-center"
              style={{ backgroundColor: chosen.tint }}
            >
              <Disc3 size={30} strokeWidth={1.5} style={{ color: chosen.swatch }} />
            </div>
          ) : empty ? (
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
          {editingName && onRename ? (
            <input
              ref={nameInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setDraft(album.name);
                  setEditingName(false);
                }
              }}
              aria-label="Album name"
              className="w-full rounded-lg bg-transparent text-[1.375rem] font-bold leading-tight outline-none focus-visible:ring-2 focus-visible:ring-[var(--cog-border-gold)]"
              style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", padding: 0 }}
            />
          ) : (
            <h2 className="min-w-0 truncate text-[1.375rem] font-bold leading-tight">
              <button
                onClick={onRename ? () => { setDraft(album.name); setEditingName(true); } : undefined}
                aria-label={onRename ? `Album name: ${album.name} — tap to rename` : album.name}
                className="max-w-full truncate rounded-lg text-left transition-colors duration-150"
                style={{ fontFamily: "var(--font-display)", color: "var(--cog-charcoal)", minHeight: 32 }}
              >
                {album.name}
              </button>
            </h2>
          )}
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
