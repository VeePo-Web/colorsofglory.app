import { useEffect, useMemo, useRef } from "react";
import type { SongCard as SongRow } from "@/integrations/cog/songs";
import type { LibraryDensity, LibrarySort, LibraryView } from "@/lib/library/libraryPrefs";
import SongGridCard from "./SongGridCard";
import SongListRow from "./SongListRow";
import LibrarySkeleton from "./LibrarySkeleton";
import AlphaScrubber from "./AlphaScrubber";
import SwipeableRow from "./SwipeableRow";

interface LibrarySongListProps {
  songs: SongRow[];
  view: LibraryView;
  density: LibraryDensity;
  onDensityChange: (d: LibraryDensity) => void;
  sort: LibrarySort;
  query: string;
  loading: boolean;
  emptyCopy: string;
  onOpen: (id: string) => void;
  onSongActions?: (song: SongRow) => void;
  /** Swipe-left on an owned list row → archive (or restore when archived). */
  onSwipeArchive?: (song: SongRow) => void;
  /** Inside an album: swipe-left removes the song from the album (not archive). */
  onSwipeRemoveFromAlbum?: (song: SongRow) => void;
  /** Songs held at the top of the library (Apple Notes pinning). */
  pinnedIds?: Set<string>;
  /** Group by month (Archived tab, recent sort) — Apple Photos rhythm. */
  monthSections?: boolean;
  /** Offered when a search finds nothing — jump to the memory graph. */
  onSearchMemory?: () => void;
  /** Batch-select mode (Apple Photos): tap toggles, checkmarks appear. */
  selecting?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (song: SongRow) => void;
}

/**
 * Pinch on the grid to change density — the Apple Photos gesture. Pinch out
 * → bigger cards (2-across); pinch in → more songs per glance (3-across).
 * Pure refs during the gesture: zero React re-renders until the step fires.
 */
function usePinchDensity(density: LibraryDensity, onChange: (d: LibraryDensity) => void) {
  const startDist = useRef<number | null>(null);

  const dist = (t: React.TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches.length === 2) startDist.current = dist(e.touches);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (startDist.current === null || e.touches.length !== 2) return;
      const ratio = dist(e.touches) / startDist.current;
      if (ratio > 1.25 && density !== 2) {
        onChange(2);
        startDist.current = dist(e.touches);
      } else if (ratio < 0.8 && density !== 3) {
        onChange(3);
        startDist.current = dist(e.touches);
      }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (e.touches.length < 2) startDist.current = null;
    },
  };
}

/**
 * LibrarySongList — renders the catalog in the chosen view: comfortable
 * grid, compact grid (pinch or button), or Apple Music-style list with
 * A-to-Z section headers when sorted alphabetically.
 */
const LibrarySongList = ({
  songs,
  view,
  density,
  onDensityChange,
  sort,
  query,
  loading,
  emptyCopy,
  onOpen,
  onSongActions,
  onSwipeArchive,
  onSwipeRemoveFromAlbum,
  pinnedIds,
  monthSections = false,
  onSearchMemory,
  selecting = false,
  selectedIds,
  onToggleSelect,
}: LibrarySongListProps) => {
  const pinch = usePinchDensity(density, onDensityChange);
  const gridRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Desktop parity for the density gesture: a trackpad pinch (or ctrl+wheel)
  // reports as a ctrlKey wheel event — zoom in for bigger cards, out for
  // more. Non-passive listener so the browser's page-zoom doesn't fire.
  useEffect(() => {
    const el = gridRef.current;
    if (!el || view !== "grid") return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY < -8 && density !== 2) onDensityChange(2);
      else if (e.deltaY > 8 && density !== 3) onDensityChange(3);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [view, density, onDensityChange]);

  // Instant jump for the A–Z scrubber — offset clears the sticky dark header.
  const jumpToLetter = (letter: string) => {
    const el = sectionRefs.current[letter];
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 150 });
  };

  // A–Z sections for the alphabetical list — the Apple Music Library pattern.
  const alphaSections = useMemo(() => {
    if (view !== "list" || sort !== "alpha") return null;
    const map = new Map<string, SongRow[]>();
    for (const song of songs) {
      const first = song.title.trim().charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : "#";
      const bucket = map.get(letter);
      if (bucket) bucket.push(song);
      else map.set(letter, [song]);
    }
    return [...map.entries()];
  }, [songs, view, sort]);

  // Month sections for the archive — "June 2026" keeps archived songs safe
  // AND navigable (PV11 archive trust; Apple Photos rhythm).
  const monthGroups = useMemo(() => {
    if (!monthSections || sort !== "recent") return null;
    const groups: { label: string; songs: SongRow[] }[] = [];
    for (const song of songs) {
      const iso = song.last_activity_at ?? song.created_at;
      const label = iso
        ? new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" })
        : "Earlier";
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.songs.push(song);
      else groups.push({ label, songs: [song] });
    }
    return groups.length > 1 ? groups : null;
  }, [songs, monthSections, sort]);

  // Skeleton cards while loading — never a blank page, never a spinner (PV11).
  if (loading && songs.length === 0) {
    return <LibrarySkeleton view={view} density={density} />;
  }

  if (songs.length === 0) {
    return (
      <div className="pt-16 text-center">
        <p
          className="text-[0.9375rem]"
          style={{ color: "var(--cog-muted)", fontFamily: "var(--font-body)" }}
        >
          {query ? `No songs match “${query}”.` : emptyCopy}
        </p>
        {query && onSearchMemory && (
          <button
            onClick={onSearchMemory}
            className="mt-4 text-[0.8125rem] font-semibold transition-transform duration-150 active:scale-95"
            style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)", minHeight: 44 }}
          >
            Search your memory instead →
          </button>
        )}
      </div>
    );
  }

  const rowFor = (song: SongRow) => {
    const row = (
      <SongListRow
        song={song}
        onClick={() => (selecting ? onToggleSelect?.(song) : onOpen(song.id))}
        onLongPress={onSongActions ? () => onSongActions(song) : undefined}
        pinned={pinnedIds?.has(song.id)}
        selecting={selecting}
        selected={selectedIds?.has(song.id)}
      />
    );
    // Swipe triage is the owner's gesture — invited rows stay tap-only, and
    // swipe is suspended entirely while batch-selecting. Inside an album the
    // swipe removes the song from that album; elsewhere it archives/restores.
    if (!selecting && song.my_role === "owner" && (onSwipeRemoveFromAlbum || onSwipeArchive)) {
      const inAlbum = Boolean(onSwipeRemoveFromAlbum);
      return (
        <SwipeableRow
          key={song.id}
          mode={inAlbum ? "remove" : song.status === "archived" ? "restore" : "archive"}
          onSwipe={() => (inAlbum ? onSwipeRemoveFromAlbum!(song) : onSwipeArchive!(song))}
        >
          {row}
        </SwipeableRow>
      );
    }
    return <div key={song.id}>{row}</div>;
  };

  if (view === "list") {
    if (alphaSections) {
      return (
        <div key="list-alpha" className="flex animate-in fade-in flex-col gap-2 duration-200">
          {alphaSections.map(([letter, group]) => (
            <section
              key={letter}
              ref={(el) => {
                sectionRefs.current[letter] = el;
              }}
              aria-label={`Songs starting with ${letter}`}
            >
              <p
                className="px-1 pb-1.5 pt-2 text-[0.6875rem] font-bold uppercase tracking-[0.1em]"
                style={{ color: "var(--cog-gold)", fontFamily: "var(--font-body)" }}
              >
                {letter}
              </p>
              <div className="flex flex-col gap-2">{group.map(rowFor)}</div>
            </section>
          ))}
          {/* Index rail appears once the catalog is big enough to need it */}
          {alphaSections.length > 4 && (
            <AlphaScrubber letters={alphaSections.map(([l]) => l)} onJump={jumpToLetter} />
          )}
        </div>
      );
    }
    if (monthGroups) {
      return (
        <div key="list-months" className="flex animate-in fade-in flex-col gap-2 duration-200">
          {monthGroups.map(({ label, songs: group }) => (
            <section key={label} aria-label={label}>
              <p
                className="px-1 pb-1.5 pt-2 text-[0.6875rem] font-bold uppercase tracking-[0.12em]"
                style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
              >
                {label}
              </p>
              <div className="flex flex-col gap-2">{group.map(rowFor)}</div>
            </section>
          ))}
        </div>
      );
    }
    return (
      <div key="list" className="flex animate-in fade-in flex-col gap-2 duration-200">
        {songs.map(rowFor)}
      </div>
    );
  }

  // Grid — density 2 (comfortable) or 3 (compact). touch-action keeps
  // one-finger scroll native while the two-finger pinch is ours.
  const gridClass =
    density === 2
      ? "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4"
      : "grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3 lg:grid-cols-5";

  const gridCardFor = (song: SongRow) => (
    <SongGridCard
      key={song.id}
      song={song}
      compact={density === 3}
      onClick={() => (selecting ? onToggleSelect?.(song) : onOpen(song.id))}
      onLongPress={onSongActions ? () => onSongActions(song) : undefined}
      pinned={pinnedIds?.has(song.id)}
      selecting={selecting}
      selected={selectedIds?.has(song.id)}
    />
  );

  if (monthGroups) {
    return (
      <div
        {...pinch}
        ref={gridRef}
        key={`grid-months-${density}`}
        className="animate-in fade-in duration-200"
        style={{ touchAction: "pan-y" }}
      >
        {monthGroups.map(({ label, songs: group }) => (
          <section key={label} aria-label={label} className="mb-4">
            <p
              className="px-1 pb-2 text-[0.6875rem] font-bold uppercase tracking-[0.12em]"
              style={{ color: "var(--cog-warm-gray)", fontFamily: "var(--font-body)" }}
            >
              {label}
            </p>
            <div className={gridClass}>{group.map(gridCardFor)}</div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div
      {...pinch}
      ref={gridRef}
      key={`grid-${density}`}
      className={`${gridClass} animate-in fade-in duration-200`}
      style={{ touchAction: "pan-y" }}
    >
      {songs.map(gridCardFor)}
    </div>
  );
};

export default LibrarySongList;
