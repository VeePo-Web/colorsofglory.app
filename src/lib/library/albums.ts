/**
 * Albums — the songwriter's own groupings of songs (an EP in progress, a
 * Sunday setlist, a season of writing). Frontend-only collections stored in
 * localStorage; an album never owns a song, it only references song ids, so
 * deleting an album never touches a song. If a backing table arrives later,
 * this module is the single seam to swap.
 */
export interface SongAlbum {
  id: string;
  name: string;
  songIds: string[];
  createdAt: string;
}

const KEY = "cog:library-albums";

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `album-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function listAlbums(): SongAlbum[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is SongAlbum =>
        a &&
        typeof a.id === "string" &&
        typeof a.name === "string" &&
        Array.isArray(a.songIds),
    );
  } catch {
    return [];
  }
}

function persist(albums: SongAlbum[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(albums));
  } catch {
    // Storage unavailable — album edits simply don't persist this session.
  }
}

export function createAlbum(name: string, songIds: string[]): SongAlbum {
  const album: SongAlbum = {
    id: makeId(),
    name: name.trim() || "Untitled album",
    songIds,
    createdAt: new Date().toISOString(),
  };
  persist([...listAlbums(), album]);
  return album;
}

export function updateAlbum(
  id: string,
  changes: { name?: string; songIds?: string[] },
): SongAlbum[] {
  const next = listAlbums().map((a) =>
    a.id === id
      ? {
          ...a,
          name: changes.name !== undefined ? changes.name.trim() || a.name : a.name,
          songIds: changes.songIds ?? a.songIds,
        }
      : a,
  );
  persist(next);
  return next;
}

export function deleteAlbum(id: string): SongAlbum[] {
  const next = listAlbums().filter((a) => a.id !== id);
  persist(next);
  return next;
}

/** Persist a new shelf order (drag-to-reorder). Unknown ids keep their place at the end. */
export function reorderAlbums(orderedIds: string[]): SongAlbum[] {
  const all = listAlbums();
  const byId = new Map(all.map((a) => [a.id, a]));
  const next = [
    ...orderedIds.map((id) => byId.get(id)).filter((a): a is SongAlbum => Boolean(a)),
    ...all.filter((a) => !orderedIds.includes(a.id)),
  ];
  persist(next);
  return next;
}
