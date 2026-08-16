/**
 * importBatch — pure batch truths for multi-file import (Lane D · Moment 3).
 *
 * The law (vision Part 1, Law 7 + Feature 11 L331): in a batch, EVERY file
 * has its own truth — per-card state lives on the cards themselves — and the
 * batch speaks through ONE calm summary line, never a global spinner and
 * never a dashboard. A failed file retries alone; the sentence about it
 * names the count and the fix.
 *
 * Duplicate detection (Feature 11 MVP): the same memo imported twice is the
 * most common real slip (the Files picker reopens on Recents — the file you
 * just sent is the first thing your thumb finds). Client-side signals are
 * the suggested TITLE (from the filename) and the DURATION; both must agree
 * before we ever question the writer — a re-recorded idea under the same
 * name (different length) is NOT a duplicate.
 */

export type BatchFileState = "saving" | "saved" | "failed";

/** The one calm line above the cards. Null = say nothing (no batch). */
export function summarizeBatch(states: BatchFileState[]): string | null {
  const n = states.length;
  if (n === 0) return null;
  const saved = states.filter((s) => s === "saved").length;
  const failed = states.filter((s) => s === "failed").length;
  const active = n - saved - failed;
  if (active > 0) {
    if (saved > 0 || failed > 0) return `Saving ${active} of ${n}…`;
    return n === 1 ? "Saving…" : `Saving ${n}…`;
  }
  if (failed === 0) return n === 1 ? "Saved" : `${n} saved`;
  if (saved === 0) return failed === 1 ? "That one needs a retry." : `${failed} need a retry.`;
  return `${saved} saved. ${failed} ${failed === 1 ? "needs" : "need"} a retry.`;
}

/** True when every file in the batch has landed (the line may say "n saved"
 *  briefly, then the page lets it go). */
export function batchSettled(states: BatchFileState[]): boolean {
  return states.length > 0 && states.every((s) => s !== "saving");
}

/** Durations must agree within this window for a title match to count as a
 *  duplicate — beyond it, same name + different length = a new take. */
const DUP_DURATION_TOLERANCE_MS = 2000;

export function isLikelyDuplicate(
  candidate: { title: string | null; durationMs: number },
  existing: Array<{ title: string; durationMs: number }>,
): boolean {
  if (!candidate.title) return false; // nothing to compare — never question a nameless file
  const t = candidate.title.trim().toLowerCase();
  if (t.length === 0) return false;
  return existing.some((m) => {
    if (m.title.trim().toLowerCase() !== t) return false;
    // Either side missing a duration → the title match stands alone.
    if (!candidate.durationMs || !m.durationMs) return true;
    return Math.abs(candidate.durationMs - m.durationMs) <= DUP_DURATION_TOLERANCE_MS;
  });
}
