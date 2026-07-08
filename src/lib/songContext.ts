/**
 * Active-song bridge (A4 · client state).
 *
 * This is a thin SESSION POINTER + read-through continuity cache — never a data
 * source. Its only job is to let a freshly-navigated screen paint the song's
 * title INSTANTLY (from the last thing we knew) while the real detail loads. The
 * real title always comes from the backend (cog/songs → get_song_detail).
 *
 * The former mock catalog (fake titles rendered on a cache miss) is gone. On a
 * cold miss we return null / "" so callers show a skeleton, not a stranger's song.
 *
 * One bridge, not two: setSong writes both cog:active-song (the canonical
 * pointer) and cog:first-song (the legacy key some onboarding screens still
 * read) so "which song am I in" has a single writer.
 */

import { useQuery } from "@tanstack/react-query";
import { getSong as fetchSongDetail } from "@/integrations/cog/songs";

const KEY = "cog:active-song";
const LEGACY_FIRST_SONG_KEY = "cog:first-song";

export interface SongSession {
  id: string;
  title: string;
  key?: string | null;
  bpm?: string | null;
  ownerInitials?: string;
}

/** The cached pointer for `id`, or null when we've never seen it this session. */
export function getSong(id: string): SongSession | null {
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as SongSession;
    if (stored?.id === id && stored?.title) return stored;
    const legacy = JSON.parse(sessionStorage.getItem(LEGACY_FIRST_SONG_KEY) ?? "{}") as {
      id?: string;
      title?: string;
    };
    if (legacy?.id === id && legacy?.title) return { id, title: legacy.title };
  } catch {
    // ignore
  }
  return null;
}

export function setSong(song: SongSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(song));
    sessionStorage.setItem(
      LEGACY_FIRST_SONG_KEY,
      JSON.stringify({ id: song.id, title: song.title, key: song.key ?? null, bpm: song.bpm ?? null }),
    );
  } catch {
    // Storage is unavailable.
  }
}

/** Query key for a song's detail — shared with the cache-invalidation policy. */
export const songDetailKey = (id: string) => ["song", id, "detail"] as const;

/**
 * Real song title with instant first paint: live backend title preferred, cached
 * session pointer as the no-flash fallback, "" (skeleton) when neither is known.
 */
export function useSongTitle(id: string | undefined): string {
  const cached = id ? getSong(id) : null;

  const { data } = useQuery({
    queryKey: id ? songDetailKey(id) : ["song", "none", "detail"],
    queryFn: () => fetchSongDetail(id as string),
    enabled: Boolean(id),
  });

  if (data?.title) {
    if (id && cached?.title !== data.title) setSong({ id, title: data.title });
    return data.title;
  }
  return cached?.title ?? "";
}
