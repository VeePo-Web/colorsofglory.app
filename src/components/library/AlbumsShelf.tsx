import { Plus, Pencil, Disc3, Layers } from "lucide-react";
import type { SongCard as SongRow } from "@/integrations/cog/songs";
import type { SongAlbum } from "@/lib/library/albums";
import { coverColor } from "@/lib/library/format";
import { useShelfReorder } from "./useShelfReorder";

interface AlbumsShelfProps {
  albums: SongAlbum[];
  songs: SongRow[];
  activeAlbumId: string | null;
  onSelect: (id: string | null) => void;
  onNew: () => void;
  onEdit: (album: SongAlbum) => void;
  /** Hold a card still, then slide — commits the new shelf order. */
  onReorder: (orderedIds: string[]) => void;
  /** Songs not yet in any album — the leading "Ungrouped" smart tile. */
  ungroupedCount?: number;
  onSelectUngrouped?: () => void;
}

const FALLBACKS = [
  "var(--cog-gold-pale)",
  "var(--cog-cream-dark)",
  "var(--cog-gold-light)",
  "var(--cog-cream)",
];

/** Stacked 2×2 cover built from the album's own song colors — playlist art. */
const AlbumCover = ({ colors, empty }: { colors: string[]; empty: boolean }) => (
  <div
    aria-hidden
    className="grid h-[88px] w-[88px] grid-cols-2 grid-rows-2 overflow-hidden rounded-2xl"
    style={{ border: "1px solid var(--cog-border)" }}
  >
    {empty ? (
      <div
        className="col-span-2 row-span-2 flex items-center justify-center"
        style={{ backgroundColor: "var(--cog-gold-pale)" }}
      >
        <Disc3 size={26} strokeWidth={1.5} style={{ color: "var(--cog-gold)" }} />
      </div>
    ) : (
      Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          style={{
            background: `linear-gradient(135deg, ${colors[i] ?? FALLBACKS[i]}, var(--cog-cream-dark))`,
          }}
        />
      ))
    )}
  </div>
);

/**
 * AlbumsShelf — the songwriter's own groupings of songs-in-progress (a
 * worship EP, a Christmas collection, a season of writing) as a horizontal
 * shelf above the catalog. Tap an album to focus the library
 * on it; tap again to release. Selected album grows a quiet edit affordance.
 */
const AlbumsShelf = ({
  albums,
  songs,
  activeAlbumId,
  onSelect,
  onNew,
  onEdit,
  onReorder,
  ungroupedCount = 0,
  onSelectUngrouped,
}: AlbumsShelfProps) => {
  const songById = new Map(songs.map((s) => [s.id, s]));
  const reorder = useShelfReorder(
    albums.map((a) => a.id),
    onReorder,
  );

  return (
    <div className="mb-4">
      <p
        className="mb-2 px-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em]"
        style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
      >
        Albums
      </p>

      <div
        data-no-swipe-nav
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {/* Ungrouped smart tile — songs not yet filed into any album */}
        {ungroupedCount > 0 && onSelectUngrouped && (
          <button
            onClick={onSelectUngrouped}
            aria-label={`Ungrouped songs, ${ungroupedCount}`}
            className="w-[88px] shrink-0 text-left transition-transform duration-150 active:scale-95"
          >
            <div
              className="flex h-[88px] w-[88px] items-center justify-center rounded-2xl"
              style={{
                backgroundColor: "var(--cog-cream-light)",
                border: "1px solid var(--cog-border)",
                boxShadow: "0 2px 8px rgba(28,26,23,0.06)",
              }}
            >
              <Layers size={26} strokeWidth={1.5} style={{ color: "var(--cog-warm-gray)" }} />
            </div>
            <p
              className="mt-1.5 truncate text-[0.75rem] font-semibold"
              style={{ color: "var(--cog-charcoal)", fontFamily: "var(--font-body)" }}
            >
              Ungrouped
            </p>
            <p className="text-[0.6875rem]" style={{ color: "var(--cog-muted)" }}>
              {ungroupedCount} {ungroupedCount === 1 ? "song" : "songs"}
            </p>
          </button>
        )}

        {albums.map((album) => {
          const albumSongs = album.songIds
            .map((id) => songById.get(id))
            .filter((s): s is SongRow => Boolean(s));
          const selected = activeAlbumId === album.id;
          const { ref, style, ...dragHandlers } = reorder.handlersFor(album.id);

          return (
            <div
              key={album.id}
              ref={ref}
              {...dragHandlers}
              className="relative w-[88px] shrink-0 select-none"
              style={{ WebkitTouchCallout: "none", ...style }}
            >
              <button
                onClick={() => onSelect(selected ? null : album.id)}
                aria-pressed={selected}
                aria-label={`${selected ? "Show all songs" : `Show album ${album.name}`}, ${albumSongs.length} ${albumSongs.length === 1 ? "song" : "songs"}`}
                className="w-full text-left transition-transform duration-150 active:scale-95"
              >
                <div
                  className="rounded-2xl transition-shadow duration-200"
                  style={{
                    boxShadow: selected
                      ? "0 0 0 2px var(--cog-gold), 0 10px 24px -12px rgba(184,149,58,0.45)"
                      : "0 2px 8px rgba(28,26,23,0.06)",
                  }}
                >
                  <AlbumCover
                    colors={albumSongs.slice(0, 4).map((s) => coverColor(s.cover_color))}
                    empty={albumSongs.length === 0}
                  />
                </div>
                <p
                  className="mt-1.5 truncate text-[0.75rem] font-semibold"
                  style={{
                    color: selected ? "var(--cog-gold)" : "var(--cog-charcoal)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {album.name}
                </p>
                <p className="text-[0.6875rem]" style={{ color: "var(--cog-muted)" }}>
                  {albumSongs.length} {albumSongs.length === 1 ? "song" : "songs"}
                </p>
              </button>

              {selected && (
                <button
                  onClick={() => onEdit(album)}
                  aria-label={`Edit album ${album.name}`}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white transition-transform duration-150 active:scale-90"
                  style={{
                    border: "1px solid var(--cog-border-gold)",
                    color: "var(--cog-gold)",
                    boxShadow: "0 2px 8px rgba(28,26,23,0.14)",
                  }}
                >
                  <Pencil size={13} strokeWidth={2} />
                </button>
              )}
            </div>
          );
        })}

        {/* New album */}
        <button
          onClick={onNew}
          aria-label="New album"
          className="w-[88px] shrink-0 text-left transition-transform duration-150 active:scale-95"
        >
          <div
            className="flex h-[88px] w-[88px] items-center justify-center rounded-2xl"
            style={{
              border: "1.5px dashed var(--cog-border-gold)",
              backgroundColor: "var(--cog-cream-light)",
            }}
          >
            <Plus size={20} strokeWidth={2} style={{ color: "var(--cog-gold)" }} />
          </div>
          <p
            className="mt-1.5 text-[0.75rem] font-semibold"
            style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
          >
            New album
          </p>
        </button>
      </div>
    </div>
  );
};

export default AlbumsShelf;
