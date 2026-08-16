import type { BandIndex, BandPerson } from "./bandIndex";
import type { SongPulse } from "./useCatalogPulse";

/**
 * Album badges — pure logic, no I/O (the bandIndex discipline).
 *
 * The Drive law "the row tells you everything" applied to an album's cover:
 * WHO is on this EP (the union of its songs' people) and WHAT's new inside
 * (the sum of its songs' unseen counts, voiced by the freshest song's
 * "Sarah · 2h" line). Zero new data — both derive from the band index and
 * the catalog pulse the shelf already holds.
 */

/**
 * The people across an album's songs, minus me — "who's on this EP",
 * answered from the shelf without opening it.
 *
 * `people` (which already excludes me and is ordered most-shared-first) is
 * the iteration spine, so the faces keep the band's own prominence order,
 * never reshuffling underfoot as songs come and go.
 */
export function albumFaces(
  songIds: string[],
  membersBySong: BandIndex["membersBySong"],
  people: BandPerson[],
): BandPerson[] {
  if (songIds.length === 0 || people.length === 0) return [];
  const inAlbum = new Set<string>();
  for (const id of songIds) {
    const members = membersBySong.get(id);
    if (!members) continue;
    for (const userId of members) inAlbum.add(userId);
  }
  return people.filter((p) => inAlbum.has(p.userId));
}

export interface AlbumPulse {
  /** Total unseen activity across the album's songs — any > 0 → the gold dot. */
  unseen: number;
  /** The freshest song's "Sarah · 2h" line — who touched this EP last. */
  line: string | null;
}

/**
 * An album's pulse = the max-freshness voice of its songs. Null when the
 * album has nothing to say (no lines, nothing unseen) so the cover can fall
 * back to its plain song count.
 */
export function albumPulse(
  songIds: string[],
  pulseBySong: Map<string, SongPulse>,
): AlbumPulse | null {
  let unseen = 0;
  let line: string | null = null;
  let freshest = Number.NEGATIVE_INFINITY;
  for (const id of songIds) {
    const pulse = pulseBySong.get(id);
    if (!pulse) continue;
    unseen += pulse.unseen;
    if (pulse.line && pulse.at) {
      const t = new Date(pulse.at).getTime();
      if (Number.isFinite(t) && t > freshest) {
        freshest = t;
        line = pulse.line;
      }
    }
  }
  if (unseen === 0 && line === null) return null;
  return { unseen, line };
}
