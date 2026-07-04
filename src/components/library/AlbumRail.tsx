import type { ReactNode } from "react";
import { Disc3, Layers, Music, Plus } from "lucide-react";
import type { SongAlbum } from "@/lib/library/albums";

interface AlbumRailProps {
  albums: SongAlbum[];
  activeAlbumId: string | null;
  ungroupedActive: boolean;
  ungroupedCount: number;
  onSelectAll: () => void;
  onSelectUngrouped: () => void;
  onSelectAlbum: (id: string) => void;
  onNewAlbum: () => void;
}

/**
 * AlbumRail — the tablet/desktop (lg+) persistent album sidebar, the Apple
 * Music library pattern: "All songs", the "Ungrouped" smart group, every
 * album, and "New album" always in view, so a songwriter moves between the
 * projects they're writing in one tap without a horizontal shelf. Hidden on
 * phones and portrait tablets (the horizontal shelf owns those); this only
 * renders at lg, so the mobile layout is untouched.
 */
const AlbumRail = ({
  albums,
  activeAlbumId,
  ungroupedActive,
  ungroupedCount,
  onSelectAll,
  onSelectUngrouped,
  onSelectAlbum,
  onNewAlbum,
}: AlbumRailProps) => {
  const rowBase =
    "flex w-full items-center gap-2.5 rounded-xl px-3 text-left transition-colors duration-150";

  const Row = ({
    active,
    onClick,
    icon,
    label,
    count,
    accent = false,
  }: {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    label: string;
    count?: number;
    accent?: boolean;
  }) => (
    <button
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`${rowBase} ${active ? "" : "hover:bg-[var(--cog-cream)]"}`}
      style={{
        minHeight: 40,
        backgroundColor: active ? "var(--cog-gold-pale)" : "transparent",
      }}
    >
      <span style={{ color: active || accent ? "var(--cog-gold)" : "var(--cog-warm-gray)" }}>
        {icon}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-[0.875rem]"
        style={{
          color: active ? "var(--cog-gold)" : accent ? "var(--cog-gold)" : "var(--cog-charcoal)",
          fontFamily: "var(--font-body)",
          fontWeight: active ? 700 : accent ? 600 : 500,
        }}
      >
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[0.75rem]" style={{ color: "var(--cog-muted)" }}>
          {count}
        </span>
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
          />
        ))}

        <Row
          active={false}
          accent
          onClick={onNewAlbum}
          icon={<Plus size={16} strokeWidth={2.2} />}
          label="New album"
        />
      </div>
    </nav>
  );
};

export default AlbumRail;
