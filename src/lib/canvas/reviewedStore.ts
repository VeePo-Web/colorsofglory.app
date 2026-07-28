/**
 * reviewedStore — the owner's "Keep in Ideas" review decisions, remembered.
 *
 * "Keep in Ideas" only flipped a `reviewed` flag in React state, so every
 * reload (and every server hydrate, which rebuilds cards from rows that carry
 * no such flag) resurrected already-decided items into the review queue —
 * making the owner re-decide the same ideas forever. The decision is the
 * owner's memory, and memory must survive the session: a small per-song
 * localStorage set, consulted by the pending-review filter.
 *
 * Device-local by design until the backend carries review state (filed with
 * the Lovable lane): a decision made on this phone stays decided on this
 * phone, which is strictly better than decided-nowhere.
 */

const KEY = (songId: string) => `cog:reviewed-${songId}`;
const MAX_IDS = 500;

export function readReviewedIds(songId: string): Set<string> {
  try {
    const raw = localStorage.getItem(KEY(songId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/** Record one decision; returns the NEW set (fresh identity for React state). */
export function markReviewedId(songId: string, cardId: string): Set<string> {
  const next = new Set(readReviewedIds(songId));
  next.add(cardId);
  try {
    localStorage.setItem(KEY(songId), JSON.stringify([...next].slice(-MAX_IDS)));
  } catch {
    /* storage full/unavailable — the session state still holds the decision */
  }
  return next;
}
