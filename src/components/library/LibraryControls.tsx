import { useEffect, useRef, useState } from "react";
import { Search, X, ArrowUpDown, Check, LayoutGrid, Grid3x3, List } from "lucide-react";
import {
  SORT_LABELS,
  type LibrarySort,
  type LibraryView,
  type LibraryDensity,
} from "@/lib/library/libraryPrefs";

interface LibraryControlsProps {
  query: string;
  onQueryChange: (q: string) => void;
  sort: LibrarySort;
  onSortChange: (s: LibrarySort) => void;
  view: LibraryView;
  density: LibraryDensity;
  onViewCycle: () => void;
}

const SORT_ORDER: LibrarySort[] = ["recent", "created", "alpha", "ideas"];

/**
 * LibraryControls — the Apple-Library control row: iOS search field,
 * sort menu, and a single view button that cycles comfortable grid →
 * compact grid → list (pinching the grid does the same thing).
 */
const LibraryControls = ({
  query,
  onQueryChange,
  sort,
  onSortChange,
  view,
  density,
  onViewCycle,
}: LibraryControlsProps) => {
  const [sortOpen, setSortOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sortOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sortOpen]);

  const viewIcon =
    view === "list" ? (
      <List size={17} strokeWidth={2} />
    ) : density === 2 ? (
      <LayoutGrid size={17} strokeWidth={2} />
    ) : (
      <Grid3x3 size={17} strokeWidth={2} />
    );

  const nextViewLabel =
    view === "list"
      ? "Switch to grid view"
      : density === 2
      ? "Switch to compact grid"
      : "Switch to list view";

  return (
    <div className="mb-4 flex items-center gap-2">
      {/* iOS-style search field — 16px font so iOS never zooms on focus */}
      <div className="relative min-w-0 flex-1">
        <Search
          size={15}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--cog-muted)" }}
        />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search your songs"
          aria-label="Search your songs"
          className="h-11 w-full rounded-full border-none pl-9 pr-9 outline-none focus-visible:ring-2 focus-visible:ring-[var(--cog-border-gold)] [&::-webkit-search-cancel-button]:hidden"
          style={{
            backgroundColor: "var(--cog-cream-dark)",
            color: "var(--cog-charcoal)",
            fontFamily: "var(--font-body)",
            fontSize: 16,
          }}
        />
        {query && (
          <button
            onClick={() => onQueryChange("")}
            aria-label="Clear search"
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full active:scale-90 transition-transform duration-150"
            style={{ color: "var(--cog-warm-gray)" }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Sort menu */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setSortOpen((o) => !o)}
          aria-label={`Sort: ${SORT_LABELS[sort]}`}
          aria-expanded={sortOpen}
          aria-haspopup="menu"
          className="flex h-11 w-11 items-center justify-center rounded-full transition-all duration-150 active:scale-90"
          style={{
            backgroundColor: sortOpen ? "var(--cog-gold-pale)" : "var(--cog-cream-dark)",
            color: sortOpen ? "var(--cog-gold)" : "var(--cog-warm-gray)",
          }}
        >
          <ArrowUpDown size={16} strokeWidth={2} />
        </button>

        {sortOpen && (
          <>
            {/* Tap-away backdrop */}
            <button
              aria-hidden
              tabIndex={-1}
              className="fixed inset-0 z-[480] cursor-default"
              onClick={() => setSortOpen(false)}
            />
            <div
              role="menu"
              aria-label="Sort songs"
              className="absolute right-0 top-12 z-[490] w-52 overflow-hidden rounded-2xl bg-white py-1"
              style={{
                border: "1px solid var(--cog-border)",
                boxShadow: "0 16px 40px rgba(28,26,23,0.14)",
              }}
            >
              {SORT_ORDER.map((s) => (
                <button
                  key={s}
                  role="menuitemradio"
                  aria-checked={sort === s}
                  onClick={() => {
                    onSortChange(s);
                    setSortOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-[0.875rem] transition-colors duration-150 hover:bg-[var(--cog-cream)]"
                  style={{
                    color: sort === s ? "var(--cog-gold)" : "var(--cog-charcoal)",
                    fontFamily: "var(--font-body)",
                    fontWeight: sort === s ? 600 : 400,
                  }}
                >
                  {SORT_LABELS[s]}
                  {sort === s && <Check size={15} strokeWidth={2.5} />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* View cycle: comfortable grid → compact grid → list */}
      <button
        onClick={onViewCycle}
        aria-label={nextViewLabel}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-150 active:scale-90"
        style={{ backgroundColor: "var(--cog-cream-dark)", color: "var(--cog-warm-gray)" }}
      >
        {viewIcon}
      </button>
    </div>
  );
};

export default LibraryControls;
