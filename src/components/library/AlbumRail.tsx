import { useState, type DragEvent, type ReactNode } from "react";
import { Disc3, Layers, Music } from "lucide-react";
import type { SongAlbum } from "@/lib/library/albums";
import type { AlbumPulse } from "@/lib/library/albumBadges";
import { albumColor } from "@/lib/library/albumColors";
import { dragHasSong, readDraggedSong } from "@/lib/library/songDrag";

interface AlbumRailProps {
  albums: SongAlbum[];
  activeAlbumId: string | null;
  ungroupedActive: boolean;
  ungroupedCount: number;
  onSelectAll: () => void;
  onSelectUngrouped: () => void;
  onSelectAlbum: (id: string) => void;
  /** What's new inside each album — drives the rail's gold dot. */
  pulseFor?: (album: SongAlbum) => AlbumPulse | null;
  /** C5: a dragged song dropped on an album row files into it (additive). */
  onDropSong?: (albumId: string, songId: string) => void;
}

/**
 * AlbumRail — the tablet/desktop (lg+) persistent album sidebar, the Apple
 * Music library pattern: "All songs", the "Ungrouped" smart group, and every
 * album, so a songwriter moves between the projects they're writing in one
 * tap without a horizontal shelf. Creation lives behind the library's one
 * "+ New" door (NewSheet) — the rail only navigates. Hidden on phones and
 * portrait tablets (the horizontal shelf owns those); this only renders at
 * lg, so the mobile layout is untouched.
 */
const AlbumRail = ({
  albums,
  activeAlbumId,
  ungroupedActive,
  ungroupedCount,
  onSelectAll,
  onSelectUngrouped,
  onSelectAlbum,
  pulseFor,
  onDropSong,
}: AlbumRailProps) => {
  const rowBase =
    "flex w-full items-center gap-2.5 rounded-xl px-3 text-left transition-colors duration-150";

  // C5: which album row a dragged song is hovering (one state at rail level —
  // Row is re-created per render, so it can never own state of its own).
  const [dropOverId, setDropOverId] = useState<string | null>(null);

  const Row = ({
    active,
    onClick,
    icon,
    label,
    count,
    iconColor,
    unseen = 0,
    dropOver = false,
    dropProps = {},
  }: {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    label: string;
    count?: number;
    /** The album's own swatch — Drive's colored folder in the sidebar. */
    iconColor?: string;
    /** Anything new inside → the quiet gold dot after the count. */
    unseen?: number;
    /** A dragged song is over this row — light the catch. */
    dropOver?: boolean;
    dropProps?: Record<string, unknown>;
  }) => (
    <button
      onClick={onClick}
      {...dropProps}
      aria-current={active ? "true" : undefined}
      className={`${rowBase} ${active ? "" : "hover:bg-[var(--cog-cream)]"}`}
      style={{
        minHeight: 40,
        backgroundColor: active || dropOver ? "var(--cog-gold-pale)" : "transparent",
        boxShadow: dropOver ? "0 0 0 2px var(--cog-gold)" : undefined,
      }}
    >
      <span style={{ color: active ? "var(--cog-gold)" : iconColor ?? "var(--cog-warm-gray)" }}>
        {icon}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-[0.875rem]"
        style={{
          color: active ? "var(--cog-gold)" : "var(--cog-charcoal)",
          fontFamily: "var(--font-body)",
          fontWeight: active ? 700 : 500,
        }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[0.75rem]" style={{ color: "var(--cog-muted)" }}>
          {count}
        </span>
      )}
      {unseen > 0 && (
        <>
          <span
            aria-hidden="true"
            className="rounded-full"
            style={{ width: 7, height: 7, backgroundColor: "var(--cog-gold)", flexShrink: 0 }}
          />
          <span className="sr-only">, {unseen} new since you were here</span>
        </>
      )}
    </button>
  );

  return (
    <nav aria-label="Albums" className="hidden lg:block lg:w-56 lg:shrink-0">
      <p
        className="mb-2 px-3 text-[0.6875rem] font-bold uppercase tracking-[0.12em]"
        style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
      >
        Library
      </p>
      <div className="flex flex-col gap-0.5">
        <Row
          active={!activeAlbumId && !ungroupedActive}
          onClick={onSelectAll}
          icon={<Music size={16} strokeWidth={1.9} />}
          label="All songs"
        />
        {albums.length > 0 && ungroupedCount > 0 && (
          <Row
            active={ungroupedActive}
            onClick={onSelectUngrouped}
            icon={<Layers size={16} strokeWidth={1.9} />}
            label="Ungrouped"
            count={ungroupedCount}
          />
        )}

        {albums.length > 0 && (
          <div className="my-1.5 h-px" style={{ backgroundColor: "var(--cog-border)" }} />
        )}

        {albums.map((album) => (
          <Row
            key={album.id}
            active={activeAlbumId === album.id}
            onClick={() => onSelectAlbum(album.id)}
            icon={<Disc3 size={16} strokeWidth={1.8} />}
            label={album.name}
            count={album.songIds.length}
            iconColor={albumColor(album.color)?.swatch}
            unseen={pulseFor?.(album)?.unseen ?? 0}
            dropOver={dropOverId === album.id}
            dropProps={
              onDropSong
                ? {
                    onDragOver: (e: DragEvent<HTMLButtonElement>) => {
                      if (dragHasSong(e)) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }
                    },
                    onDragEnter: (e: DragEvent<HTMLButtonElement>) => {
                      if (dragHasSong(e)) setDropOverId(album.id);
                    },
                    onDragLeave: (e: DragEvent<HTMLButtonElement>) => {
                      // Crossing into a child fires leave+enter — only clear
                      // when the pointer truly left this row.
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDropOverId((id) => (id === album.id ? null : id));
                      }
                    },
                    onDrop: (e: DragEvent<HTMLButtonElement>) => {
                      e.preventDefault();
                      setDropOverId(null);
                      const songId = readDraggedSong(e);
                      if (songId) onDropSong(album.id, songId);
                    },
                  }
                : {}
            }
          />
        ))}
      </div>
    </nav>
  );
};

export default AlbumRail;
