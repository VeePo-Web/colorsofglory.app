import { Pencil, Disc3, Layers } from "lucide-react";
import type { SongCard as SongRow } from "@/integrations/cog/songs";
import type { SongAlbum } from "@/lib/library/albums";
import type { AlbumPulse } from "@/lib/library/albumBadges";
import { albumColor } from "@/lib/library/albumColors";
import { coverColor } from "@/lib/library/format";
import MiniFaceStack, { type MiniFace } from "./MiniFaceStack";
import { useShelfReorder } from "./useShelfReorder";

interface AlbumsShelfProps {
  albums: SongAlbum[];
  songs: SongRow[];
  activeAlbumId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (album: SongAlbum) => void;
  /** Hold a card still, then slide — commits the new shelf order. */
  onReorder: (orderedIds: string[]) => void;
  /** Songs not yet in any album — the leading "Ungrouped" smart tile. */
  ungroupedCount?: number;
  onSelectUngrouped?: () => void;
  /** Who's on this EP — the union of its songs' people (albumFaces). */
  facesFor?: (album: SongAlbum) => MiniFace[];
  /** What's new inside — freshest "Sarah · 2h" + total unseen (albumPulse). */
  pulseFor?: (album: SongAlbum) => AlbumPulse | null;
}

const FALLBACKS = [
  "var(--cog-gold-pale)",
  "var(--cog-cream-dark)",
  "var(--cog-gold-light)",
  "var(--cog-cream)",
];

/**
 * The album's cover. A chosen color wears it SOLID (Drive's folder law: the
 * eye finds "the red one" before it reads); no color → the 2×2 mosaic of the
 * songs' own hues (playlist art); no songs → the quiet gold disc.
 */
const AlbumCover = ({ colors, empty, colorKey }: { colors: string[]; empty: boolean; colorKey?: string | null }) => {
  const chosen = albumColor(colorKey);
  return (
    <div
      aria-hidden
      className="grid h-[88px] w-[88px] grid-cols-2 grid-rows-2 overflow-hidden rounded-2xl"
      style={{ border: "1px solid var(--cog-border)" }}
    >
      {chosen ? (
        <div
          className="col-span-2 row-span-2 flex items-center justify-center"
          style={{ backgroundColor: chosen.tint }}
        >
          <Disc3 size={26} strokeWidth={1.5} style={{ color: chosen.swatch }} />
        </div>
      ) : empty ? (
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
};

/**
 * AlbumsShelf — the songwriter's own groupings of songs-in-progress (a
 * worship EP, a Christmas collection, a season of writing) as a horizontal
 * shelf above the catalog. Tap an album to focus the library
 * on it; tap again to release. Selected album grows a quiet edit affordance.
 * Making a NEW album lives behind the library's one "+ New" door (NewSheet),
 * so the shelf only ever shows real albums — never a creation ad.
 */
const AlbumsShelf = ({
  albums,
  songs,
  activeAlbumId,
  onSelect,
  onEdit,
  onReorder,
  ungroupedCount = 0,
  onSelectUngrouped,
  facesFor,
  pulseFor,
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
        {/* Ungrouped smart tile — only meaningful once at least one album
            exists (with no albums, every song is "ungrouped" by definition) */}
        {albums.length > 0 && ungroupedCount > 0 && onSelectUngrouped && (
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
          const faces = facesFor?.(album) ?? [];
          const pulse = pulseFor?.(album) ?? null;
          const countText = `${albumSongs.length} ${albumSongs.length === 1 ? "song" : "songs"}`;

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
                aria-label={[
                  selected ? "Show all songs" : `Show album ${album.name}`,
                  countText,
                  faces.length > 0 ? `with ${faces.map((f) => f.name).join(", ")}` : null,
                  pulse && pulse.unseen > 0 ? `${pulse.unseen} new since you were here` : null,
                ]
                  .filter(Boolean)
                  .join(", ")}
                className="w-full text-left transition-transform duration-150 active:scale-95"
              >
                <div
                  className="relative rounded-2xl transition-shadow duration-200"
                  style={{
                    boxShadow: selected
                      ? "0 0 0 2px var(--cog-gold), 0 10px 24px -12px rgba(184,149,58,0.45)"
                      : "0 2px 8px rgba(28,26,23,0.06)",
                  }}
                >
                  <AlbumCover
                    colors={albumSongs.slice(0, 4).map((s) => coverColor(s.cover_color))}
                    empty={albumSongs.length === 0}
                    colorKey={album.color}
                  />
                  {/* Who's on this EP — Drive's shared-folder faces, worn by
                      the cover itself (decorative: the button label carries
                      the names). */}
                  {faces.length > 0 && (
                    <span aria-hidden="true" className="absolute bottom-1.5 left-1.5">
                      <MiniFaceStack people={faces} size={16} />
                    </span>
                  )}
                  {/* Something new inside — the gold dot, ringed so it reads
                      on any cover color. */}
                  {pulse && pulse.unseen > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute rounded-full"
                      style={{
                        top: -3,
                        right: -3,
                        width: 12,
                        height: 12,
                        backgroundColor: "var(--cog-gold)",
                        border: "2px solid #FFFFFF",
                        boxShadow: "0 1px 3px rgba(28,26,23,0.25)",
                      }}
                    />
                  )}
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
                {/* "Who · when" beats a bare count once the album has a voice */}
                <p
                  className="truncate text-[0.6875rem]"
                  style={{ color: pulse?.unseen ? "var(--cog-warm-gray)" : "var(--cog-muted)" }}
                >
                  {pulse?.line ?? countText}
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

      </div>
    </div>
  );
};

export default AlbumsShelf;
