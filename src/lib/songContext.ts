/**
 * Lightweight song session store that survives within a browser session.
 * Lovable will replace this with real Supabase queries.
 * Claude reads/writes this so all song screens share the same title.
 */

const KEY = "cog:active-song";

export interface SongSession {
  id: string;
  title: string;
  key?: string | null;
  bpm?: string | null;
  ownerInitials?: string;
}

/** MOCK catalog used when no session song is set */
const MOCK_SONGS: Record<string, SongSession> = {
  "1": { id: "1", title: "Grace in the Waiting", ownerInitials: "PK" },
  "2": { id: "2", title: "Morning Prayer",         ownerInitials: "PK" },
  "3": { id: "3", title: "Holy Fire",              ownerInitials: "PK" },
};

export function getSong(id: string): SongSession {
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as SongSession;
    if (stored?.id === id && stored?.title) return stored;
  } catch {
    // ignore
  }
  return MOCK_SONGS[id] ?? { id, title: "Untitled Song" };
}

export function setSong(song: SongSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(song));
  } catch {
    // Storage is unavailable.
  }
}

/** React hook wrapper without state. */
export function useSongTitle(id: string | undefined): string {
  if (!id) return "Untitled Song";
  return getSong(id).title;
}
