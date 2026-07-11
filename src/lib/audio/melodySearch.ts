/**
 * melodySearch — Hum-to-Find's match engine (C4).
 *
 * "Which of my 40 memos had that tune?" Over a personal library of dozens,
 * query-by-humming collapses to something small and exact: index = the
 * melody_key fingerprints Melody Lens already stored at capture (free);
 * query = the same fingerprint extracted from a hum; match = SUBSEQUENCE
 * dynamic time warping of the query against each memo.
 *
 *   - KEY-invariant   — melody_key is semitone intervals from the first note,
 *                       and the matcher works on step-to-step deltas, so the
 *                       same tune in any key scores identically.
 *   - TEMPO-invariant — DTW warps the time axis, so a faster/slower hum aligns.
 *   - SUBSEQUENCE     — the hum can match any window of a longer memo (hum the
 *                       chorus; the memo opens with a verse) because the DTW
 *                       start row is free (cost 0 at every memo position).
 *
 * On-device, offline, private — the hum never leaves the phone. Pure; the UI
 * layer feeds it the query key + the stored index and renders the shortlist.
 * For a large library a Parsons edit-distance prefilter shortlists before the
 * (already cheap) DTW runs on the survivors.
 */

/** A memo's stored fingerprint, ready to search. */
export interface MelodyIndexEntry {
  memoId: string;
  melodyKey: number[];
}

export interface MelodyMatch {
  memoId: string;
  /** Raw subsequence-DTW distance (lower = closer). */
  distance: number;
  /** 0–1, 1 = a clean match. Normalized by the query length. */
  score: number;
}

/** Below this a hum is too short to identify anything. */
export const MIN_QUERY_NOTES = 3;
/** A library smaller than this isn't worth searching (soft-state the UI). */
export const MIN_LIBRARY = 8;
/** score ≥ this = a confident top result; below → "no close match" honesty. */
export const STRONG_MATCH = 0.55;
/** Above this many memos, prefilter with Parsons before DTW. */
const PREFILTER_ABOVE = 300;
/** Keep this many Parsons survivors for the full DTW pass. */
const PREFILTER_KEEP = 60;

/** Step-to-step deltas — what the matcher actually compares (double key-
 *  invariance + robustness to a wrong starting note). */
function deltas(key: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < key.length; i++) out.push(key[i] - key[i - 1]);
  return out;
}

/** Parsons code (U/D/R) from an interval sequence — the cheap prefilter. */
function parsons(key: number[]): string {
  let s = "";
  for (const d of deltas(key)) s += d > 0 ? "U" : d < 0 ? "D" : "R";
  return s;
}

/** Levenshtein edit distance between two Parsons strings (prefilter score). */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Subsequence DTW distance of `query` against `target` (both delta sequences).
 * The first row is free (any target position is a valid start) and the result
 * is the minimum over the last query row (any target position a valid end) —
 * so the query aligns to its best-matching WINDOW of the target.
 */
function subsequenceDtw(query: number[], target: number[]): number {
  const m = query.length;
  const n = target.length;
  if (m === 0) return 0;
  if (n === 0) return Infinity;

  const INF = Infinity;
  // Rolling two-row DP. Row 0 is the "before the query" boundary: cost 0 at
  // every target column (free start), INF at the query-side boundary.
  let prev = new Array<number>(n + 1).fill(0);
  prev[0] = 0;
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = INF; // consuming query with no target = impossible
    for (let j = 1; j <= n; j++) {
      const cost = Math.abs(query[i - 1] - target[j - 1]);
      curr[j] = cost + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  // Best end position along the final query row.
  let best = INF;
  for (let j = 1; j <= n; j++) if (prev[j] < best) best = prev[j];
  return best;
}

/** Convert a DTW distance to a 0–1 score, normalized by query length so long
 *  and short hums are comparable. Tuned so a clean same-tune match lands high. */
function toScore(distance: number, queryDeltas: number): number {
  if (!Number.isFinite(distance) || queryDeltas === 0) return 0;
  // ~1 semitone of average per-step drift halves the score.
  const perStep = distance / queryDeltas;
  return 1 / (1 + perStep);
}

export interface SearchOptions {
  /** Cap the shortlist. Default 5. */
  limit?: number;
}

/**
 * Rank the library against a hummed query. Returns matches sorted best-first
 * (empty when the query is too short). Pure + fast: brute DTW over dozens of
 * short sequences is sub-millisecond; a >300 library Parsons-prefilters first.
 */
export function searchMelodies(
  queryKey: number[],
  index: MelodyIndexEntry[],
  options: SearchOptions = {},
): MelodyMatch[] {
  const limit = options.limit ?? 5;
  const qd = deltas(queryKey);
  if (qd.length < MIN_QUERY_NOTES - 1) return [];

  let candidates = index.filter((e) => e.melodyKey.length >= 2);

  if (candidates.length > PREFILTER_ABOVE) {
    const qp = parsons(queryKey);
    candidates = candidates
      .map((e) => ({ e, d: editDistance(qp, parsons(e.melodyKey)) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, PREFILTER_KEEP)
      .map((x) => x.e);
  }

  const matches: MelodyMatch[] = candidates.map((entry) => {
    const distance = subsequenceDtw(qd, deltas(entry.melodyKey));
    return { memoId: entry.memoId, distance, score: toScore(distance, qd.length) };
  });

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

/** Is a ranked list confident enough to lead with, or should the UI show the
 *  honest "no close match — here are your recent melodies" state? */
export function hasStrongMatch(matches: MelodyMatch[]): boolean {
  return matches.length > 0 && matches[0].score >= STRONG_MATCH;
}
