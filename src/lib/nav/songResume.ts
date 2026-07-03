/**
 * songResume — per-song "pick up where you left off" memory.
 *
 * A songwriter who was mid-lyric in the sheet, or arranging on the canvas,
 * should land back on that exact surface when they reopen the song — not be
 * reset to the default entry. We remember the last meaningful surface per
 * song (with its search params, e.g. the canvas layer) in localStorage,
 * pruned to the most recent 50 songs. Transient flows (onboarding coaching,
 * post-save screens) are never recorded.
 */

const KEY = "cog:song-resume";
const MAX_ENTRIES = 50;

/** Surfaces worth returning to. Order-independent; matched exactly. */
const RESUMABLE = new Set(["brainstorm", "capture", "room", "canvas", "sheet", "practice", "memory"]);

interface ResumeEntry {
  path: string;
  at: number;
}

type ResumeMap = Record<string, ResumeEntry>;

const read = (): ResumeMap => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as ResumeMap;
  } catch {
    return {};
  }
};

const write = (map: ResumeMap): void => {
  try {
    const ids = Object.keys(map);
    if (ids.length > MAX_ENTRIES) {
      ids
        .sort((a, b) => map[a].at - map[b].at)
        .slice(0, ids.length - MAX_ENTRIES)
        .forEach((id) => delete map[id]);
    }
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage full or blocked — resume is a nicety, never an error */
  }
};

/** Record the surface for a song-scoped location. No-op for non-resumable paths. */
export function recordSongSurface(pathname: string, search: string): void {
  const m = pathname.match(/^\/songs\/([^/]+)(?:\/([^/]+))?$/);
  if (!m) return;
  const [, songId, surface] = m;
  if (surface !== undefined && !RESUMABLE.has(surface)) return;
  const map = read();
  map[songId] = { path: `${pathname}${search}`, at: Date.now() };
  write(map);
}

/** Where to reopen this song — the remembered surface, or null for the default. */
export function resumePathFor(songId: string): string | null {
  const entry = read()[songId];
  return entry?.path ?? null;
}
