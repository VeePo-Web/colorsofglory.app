/**
 * melodyBackfill — lazily index legacy memos as the songwriter browses (C4).
 *
 * Memos captured before Melody Lens have no contour, so Hum-to-Find can't see
 * them. Rather than a batch job, we index opportunistically: whenever a memo's
 * audio is fetched anyway (played or opened), compute its contour once and
 * persist it to the device store. Coverage grows exactly as the library gets
 * used. Everything is best-effort and de-duplicated — it never blocks playback
 * and never re-decodes a memo already indexed this session.
 *
 * On-device, offline, private: the decode + pitch happen locally; nothing is
 * uploaded. The reusable `getBlob` resolver mirrors the app's cache-first
 * playback path (audioCache → signed URL).
 */

import { computePitchContour } from "@/lib/audio/pitchContour";
import { resolveContour, writeContour } from "@/lib/audio/contourStore";
import { audioCache } from "@/lib/voice/audioCache";
import { getSignedUrl } from "@/lib/voice/voiceApi";

/** Memos DEFINITIVELY handled this session (indexed, or genuinely un-melodic)
 *  — never re-decode those. A transient fetch miss is NOT recorded here, so it
 *  re-attempts on the next open instead of being skipped for the session. */
const done = new Set<string>();

async function resolveBlob(memoId: string): Promise<Blob | null> {
  try {
    const cached = await audioCache.get(memoId);
    if (cached) return cached;
    const url = await getSignedUrl(memoId);
    if (!url) return null;
    // Warm the cache for playback too, then decode from the fetched blob.
    void audioCache.prefetch(memoId, url);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/**
 * Index one memo if it isn't already. No-op when a contour is already known
 * (server column or device store — server-aware, so it won't re-decode memos
 * the server already carries once Lovable's columns land) or we've definitively
 * handled it this session. Returns true only when it newly indexed.
 */
export async function backfillMemoContour(memoId: string): Promise<boolean> {
  if (!memoId || done.has(memoId) || resolveContour(memoId)) return false;
  const blob = await resolveBlob(memoId);
  if (!blob) return false; // transient (offline / signed-URL miss) — retry next open
  // From here the outcome is definitive: either it indexes, or the take has no
  // melody to index — either way, don't decode it again this session.
  done.add(memoId);
  const contour = await computePitchContour(blob);
  if (!contour) return false; // silent/undecodable — nothing to index, no error
  writeContour(memoId, contour);
  return true;
}

/**
 * Fire-and-forget backfill on play/open. Swallows everything — indexing must
 * never disturb playback. Returns immediately; the write lands whenever.
 */
export function backfillOnOpen(memoId: string): void {
  void backfillMemoContour(memoId).catch(() => {
    /* best-effort */
  });
}
