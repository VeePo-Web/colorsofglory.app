import type { LoopMode, PersistedPracticeSession } from "./practiceTypes";

const STORAGE_KEY = (songId: string) => `cog:practice:session:${songId}`;
const HISTORY_KEY = (songId: string) => `cog:practice:history:${songId}`;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Session persistence (resume after app close) ─────────────────────────

export function saveSession(session: PersistedPracticeSession): void {
  try {
    localStorage.setItem(STORAGE_KEY(session.songId), JSON.stringify(session));
  } catch { /* non-fatal */ }
}

export function loadSession(songId: string): PersistedPracticeSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(songId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPracticeSession;
    const age = Date.now() - new Date(parsed.savedAt).getTime();
    if (age > SESSION_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY(songId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(songId: string): void {
  try {
    localStorage.removeItem(STORAGE_KEY(songId));
  } catch { /* non-fatal */ }
}

const SESSION_PREFIX = "cog:practice:session:";

/**
 * The single newest, non-expired saved practice session across every song and
 * album — powers the "Resume practice" card on the home screen so the drive
 * picks up exactly where it left off. Prunes expired sessions as it scans.
 */
export function loadMostRecentSession(): PersistedPracticeSession | null {
  try {
    let newest: PersistedPracticeSession | null = null;
    const expired: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(SESSION_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as PersistedPracticeSession;
      const age = Date.now() - new Date(parsed.savedAt).getTime();
      if (age > SESSION_TTL_MS) { expired.push(key); continue; }
      if (!newest || new Date(parsed.savedAt) > new Date(newest.savedAt)) {
        newest = parsed;
      }
    }
    for (const key of expired) localStorage.removeItem(key);
    return newest;
  } catch {
    return null;
  }
}

/** The practice route for a saved session — album sessions reopen on the album route. */
export function practiceRouteForSession(session: PersistedPracticeSession): string {
  return session.songId.startsWith("album:")
    ? `/albums/${session.songId.slice("album:".length)}/practice`
    : `/songs/${session.songId}/practice`;
}

// ─── Practice history (mastery data) ──────────────────────────────────────

export interface SectionHistory {
  label: string;
  totalLoops: number;
  loopsAtFullSpeed: number;
  totalSessions: number;
  lastPracticed: string;
}

export interface SongHistory {
  songId: string;
  totalSessions: number;
  totalMinutesAllTime: number;
  sections: Record<string, SectionHistory>;
}

export function loadHistory(songId: string): SongHistory {
  try {
    const raw = localStorage.getItem(HISTORY_KEY(songId));
    if (!raw) return emptyHistory(songId);
    return JSON.parse(raw) as SongHistory;
  } catch {
    return emptyHistory(songId);
  }
}

export function saveHistory(history: SongHistory): void {
  try {
    localStorage.setItem(HISTORY_KEY(history.songId), JSON.stringify(history));
  } catch { /* non-fatal */ }
}

export function mergeSessionIntoHistory(
  songId: string,
  sessionMinutes: number,
  loopsPerSection: Record<string, { label: string; loops: number; atFullSpeed: number }>,
): SongHistory {
  const history = loadHistory(songId);
  history.totalSessions += 1;
  history.totalMinutesAllTime += sessionMinutes;

  for (const [sectionId, data] of Object.entries(loopsPerSection)) {
    const existing = history.sections[sectionId] ?? {
      label: data.label,
      totalLoops: 0,
      loopsAtFullSpeed: 0,
      totalSessions: 0,
      lastPracticed: new Date().toISOString(),
    };
    existing.totalLoops += data.loops;
    existing.loopsAtFullSpeed += data.atFullSpeed;
    existing.totalSessions += 1;
    existing.lastPracticed = new Date().toISOString();
    history.sections[sectionId] = existing;
  }

  saveHistory(history);
  return history;
}

function emptyHistory(songId: string): SongHistory {
  return { songId, totalSessions: 0, totalMinutesAllTime: 0, sections: {} };
}

// ─── Loop mode preference per song ────────────────────────────────────────

const MODE_KEY = (songId: string) => `cog:practice:mode:${songId}`;

export function saveLoopMode(songId: string, mode: LoopMode): void {
  try {
    localStorage.setItem(MODE_KEY(songId), mode);
  } catch { /* non-fatal */ }
}

export function loadLoopMode(songId: string): LoopMode | null {
  try {
    return (localStorage.getItem(MODE_KEY(songId)) as LoopMode) ?? null;
  } catch {
    return null;
  }
}
