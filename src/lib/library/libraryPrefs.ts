/**
 * Library view preferences — persisted locally so the catalog reopens exactly
 * the way the songwriter left it (Apple Music remembers your Library view;
 * so do we). Pure localStorage, no backend.
 */
export type LibraryView = "grid" | "list";
export type LibraryDensity = 2 | 3;
export type LibrarySort = "recent" | "alpha" | "ideas";

export interface LibraryPrefs {
  view: LibraryView;
  density: LibraryDensity;
  sort: LibrarySort;
}

const KEY = "cog:library-prefs";

export const DEFAULT_LIBRARY_PREFS: LibraryPrefs = {
  view: "grid",
  density: 2,
  sort: "recent",
};

export function loadLibraryPrefs(): LibraryPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LIBRARY_PREFS;
    const parsed = JSON.parse(raw) as Partial<LibraryPrefs>;
    return {
      view: parsed.view === "list" ? "list" : "grid",
      density: parsed.density === 3 ? 3 : 2,
      sort:
        parsed.sort === "alpha" || parsed.sort === "ideas"
          ? parsed.sort
          : "recent",
    };
  } catch {
    return DEFAULT_LIBRARY_PREFS;
  }
}

export function saveLibraryPrefs(prefs: LibraryPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Storage unavailable (private mode) — prefs simply don't persist.
  }
}

export const SORT_LABELS: Record<LibrarySort, string> = {
  recent: "Recently edited",
  alpha: "A to Z",
  ideas: "Most ideas",
};
