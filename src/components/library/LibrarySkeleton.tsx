import type { LibraryDensity, LibraryView } from "@/lib/library/libraryPrefs";

/**
 * LibrarySkeleton — static cream skeleton cards that preserve the grid rhythm
 * while songs load (PV11: skeleton cards, never a blank page or a spinner;
 * static preferred over shimmer for the premium feel).
 */
const LibrarySkeleton = ({ view, density }: { view: LibraryView; density: LibraryDensity }) => {
  if (view === "list") {
    return (
      <div className="flex flex-col gap-2" aria-hidden aria-busy="true">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl p-3"
            style={{ minHeight: 68, backgroundColor: "var(--cog-cream-light)", border: "1px solid var(--cog-border)" }}
          >
            <div className="h-11 w-11 shrink-0 rounded-xl" style={{ backgroundColor: "var(--cog-cream-dark)" }} />
            <div className="flex-1">
              <div className="mb-2 h-3.5 w-2/3 rounded-full" style={{ backgroundColor: "var(--cog-cream-dark)" }} />
              <div className="h-2.5 w-1/2 rounded-full" style={{ backgroundColor: "var(--cog-cream-dark)" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const gridClass =
    density === 2
      ? "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4"
      : "grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3 lg:grid-cols-5";

  return (
    <div className={gridClass} aria-hidden aria-busy="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl"
          style={{
            minHeight: density === 2 ? 140 : 104,
            padding: density === 2 ? 16 : 12,
            backgroundColor: "var(--cog-cream-light)",
            border: "1px solid var(--cog-border)",
          }}
        >
          <div
            className="mb-3 rounded-lg"
            style={{
              width: density === 2 ? 26 : 18,
              height: density === 2 ? 26 : 18,
              backgroundColor: "var(--cog-cream-dark)",
            }}
          />
          <div className="mb-2 h-3.5 w-4/5 rounded-full" style={{ backgroundColor: "var(--cog-cream-dark)" }} />
          <div className="h-2.5 w-1/2 rounded-full" style={{ backgroundColor: "var(--cog-cream-dark)" }} />
        </div>
      ))}
    </div>
  );
};

export default LibrarySkeleton;
