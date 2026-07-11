/**
 * Weave — the fit-scoring engine for line-level composition (D2).
 *
 * Point at a final-tree section ("Chorus") and every idea-tree line that FITS
 * — by rhyme, meter, theme — glows. This module is the honesty behind that
 * glow: pure functions that score the writer's OWN lines against the forming
 * section. It never generates a lyric, never gates a choice — a 0-score line
 * is still placeable. Guidance for the ear, not a correctness engine.
 *
 * Consumes C3's craft toolkit read-only (rhyme.ts, syllables.ts). No React.
 * The only I/O is the used-line map helpers at the bottom (localStorage,
 * per-song, presentation state only — see docs/WEAVE-CONTRACT.md §5).
 */

import { classifyRhyme, lastWord, rhymeScheme, type RhymeKind } from "@/lib/lyrics/rhyme";
import { countLineSyllables } from "@/lib/lyrics/syllables";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

// ─── Scoring weights (sum to 1) ──────────────────────────────────────────────

const RHYME_WEIGHT: Record<RhymeKind, number> = {
  perfect: 0.5,
  slant: 0.32,
  assonance: 0.16,
  none: 0,
};
const METER_WEIGHT = 0.3;
/** Syllable distance at which the meter signal reaches zero. */
const METER_FALLOFF = 4;
const THEME_WEIGHT = 0.2;
/** Shared theme stems that earn full theme credit. */
const THEME_CAP = 3;

/** Glow tiers — presentation bands, not gates. */
export const STRONG_FIT = 0.55;
export const WARM_FIT = 0.3;

export type WeaveTier = "strong" | "warm" | "faint";

export function tierOf(score: number): WeaveTier {
  if (score >= STRONG_FIT) return "strong";
  if (score >= WARM_FIT) return "warm";
  return "faint";
}

// ─── Context: what the target section "sounds like" ─────────────────────────

export interface WeaveContext {
  /** The target section's lines (trimmed, non-empty). */
  lines: string[];
  /** Rhyme-bearing ending word per line ("" filtered out). */
  endings: string[];
  /** Syllable count per line. */
  profile: number[];
  /** Median of `profile` — the section's felt meter. 0 when empty. */
  medianSyllables: number;
  /** Non-stopword stems from the section text + label — its vocabulary. */
  themeStems: Set<string>;
}

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has",
  "he", "her", "his", "i", "in", "is", "it", "its", "me", "my", "not", "of",
  "on", "or", "our", "she", "so", "that", "the", "their", "they", "this", "to",
  "up", "was", "we", "were", "will", "with", "you", "your", "am", "im",
  "ill", "id", "ive", "dont", "cant", "wont", "when", "what", "who", "how",
  "all", "can", "do", "if", "no", "oh", "out", "there",
]);

/** Light stemmer: enough to let "waiting"/"waits"/"wait" share a stem. */
function stem(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return w;
  w = w.replace(/(ing|ed|es|s|ly)$/, "");
  return w;
}

function themeStemsOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.split(/\s+/)) {
    const clean = raw.toLowerCase().replace(/[^a-z]/g, "");
    if (!clean || STOPWORDS.has(clean)) continue;
    const s = stem(clean);
    if (s.length >= 3) out.add(s);
  }
  return out;
}

export function splitLines(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Build the scoring context from the target section card's label + body. */
export function buildWeaveContext(label: string, body: string): WeaveContext {
  const lines = splitLines(body);
  const endings = lines.map((l) => lastWord(l)).filter(Boolean);
  const profile = lines.map((l) => countLineSyllables(l));
  return {
    lines,
    endings,
    profile,
    medianSyllables: median(profile),
    themeStems: themeStemsOf(`${label} ${body}`),
  };
}

// ─── Per-line fit ────────────────────────────────────────────────────────────

export interface WeaveFit {
  /** Normalized 0–1. Guidance, never a gate. */
  score: number;
  tier: WeaveTier;
  /** Best rhyme found against the section's endings (null = none). */
  rhyme: { kind: RhymeKind; with: string } | null;
  syllables: number;
  /** Distance from the section's median meter (0 when section is empty). */
  syllableDelta: number;
  /** Theme words this line shares with the section (as typed stems). */
  themeWords: string[];
  /** The human WHY behind the glow — shown in aria-labels + row subtitles. */
  reason: string;
}

/** Score one idea line against the target section. Pure. */
export function scoreLineFit(line: string, ctx: WeaveContext): WeaveFit {
  const syllables = countLineSyllables(line);

  // An empty section has no sound to fit yet. Be honest instead of
  // fake-precise: a uniform faint invitation, not a fabricated ranking.
  if (ctx.lines.length === 0) {
    return {
      score: 0.15,
      tier: "faint",
      rhyme: null,
      syllables,
      syllableDelta: 0,
      themeWords: [],
      reason: "This section is empty — any line can start it.",
    };
  }

  // Rhyme: the line's ending vs every section ending; keep the best.
  const ending = lastWord(line);
  let rhyme: WeaveFit["rhyme"] = null;
  let rhymeScore = 0;
  if (ending) {
    for (const target of ctx.endings) {
      const kind = classifyRhyme(ending, target);
      const w = RHYME_WEIGHT[kind];
      if (w > rhymeScore) {
        rhymeScore = w;
        rhyme = { kind, with: target };
      }
    }
  }

  // Meter: closeness to the section's median syllable count.
  const syllableDelta = syllables - ctx.medianSyllables;
  const meterScore =
    ctx.medianSyllables > 0
      ? Math.max(0, 1 - Math.abs(syllableDelta) / METER_FALLOFF) * METER_WEIGHT
      : 0;

  // Theme: shared non-stopword stems.
  const themeWords: string[] = [];
  for (const raw of line.split(/\s+/)) {
    const clean = raw.toLowerCase().replace(/[^a-z]/g, "");
    if (!clean || STOPWORDS.has(clean)) continue;
    if (ctx.themeStems.has(stem(clean)) && !themeWords.includes(clean)) {
      themeWords.push(clean);
    }
  }
  const themeScore = (Math.min(themeWords.length, THEME_CAP) / THEME_CAP) * THEME_WEIGHT;

  const score = Math.min(1, rhymeScore + meterScore + themeScore);

  // The WHY, in the writer's language. Strongest signal first.
  const parts: string[] = [];
  if (rhyme && rhyme.kind !== "none") {
    const label =
      rhyme.kind === "perfect" ? "rhymes with" : rhyme.kind === "slant" ? "near-rhymes with" : "echoes";
    parts.push(`${label} “${rhyme.with}”`);
  }
  if (ctx.medianSyllables > 0 && Math.abs(syllableDelta) <= 1) {
    parts.push(`${syllables} syllables — matches the meter`);
  } else {
    parts.push(`${syllables} syllables`);
  }
  if (themeWords.length > 0) {
    parts.push(`shares “${themeWords[0]}”`);
  }

  return { score, tier: tierOf(score), rhyme, syllables, syllableDelta, themeWords, reason: parts.join(" · ") };
}

// ─── Candidates: which lines glow ────────────────────────────────────────────

export interface WeaveLine {
  index: number;
  text: string;
  fit: WeaveFit;
}

/** Card types whose bodies hold weavable lines. */
const WEAVABLE_TYPES = new Set(["lyric", "section", "note"]);

export function isWeaveCandidate(card: CanvasBoardCard, targetId: string): boolean {
  return (
    card.id !== targetId &&
    card.tree === "ideas" &&
    !card.isDimmedReference &&
    !card.parentMemoId &&
    WEAVABLE_TYPES.has(card.type) &&
    splitLines(card.body).length > 0
  );
}

/**
 * The glow map: every weavable idea-tree line, scored against the target.
 * Pure — memoize at the call site off (cards, targetId, target body).
 */
export function weaveCandidates(
  cards: CanvasBoardCard[],
  target: CanvasBoardCard,
): Map<string, WeaveLine[]> {
  const ctx = buildWeaveContext(target.section || target.title, target.body);
  const map = new Map<string, WeaveLine[]>();
  for (const card of cards) {
    if (!isWeaveCandidate(card, target.id)) continue;
    const lines = splitLines(card.body).map((text, index) => ({
      index,
      text,
      fit: scoreLineFit(text, ctx),
    }));
    if (lines.length > 0) map.set(card.id, lines);
  }
  return map;
}

// ─── Ribbon + meter for the forming section (C3 read-only re-export) ────────

export interface WeaveTargetView {
  lines: string[];
  /** rhymeScheme letters, aligned with `lines` ("-" = no ending). */
  scheme: string[];
  /** Syllables per line, aligned with `lines`. */
  syllables: number[];
  medianSyllables: number;
  /** True where a line drifts ≥ DRIFT_AT from the median (guidance only). */
  drift: boolean[];
}

/** Syllable distance from the median that earns a quiet drift flag. */
export const DRIFT_AT = 3;

export function buildTargetView(body: string): WeaveTargetView {
  const lines = splitLines(body);
  const syllables = lines.map((l) => countLineSyllables(l));
  const med = median(syllables);
  return {
    lines,
    scheme: rhymeScheme(lines),
    syllables,
    medianSyllables: med,
    drift: syllables.map((s) => lines.length >= 2 && Math.abs(s - med) >= DRIFT_AT),
  };
}

// ─── Used-line map (per-song, device-local presentation state) ──────────────

/** TEXT-keyed (card + normalized line), deliberately not index-keyed: reorders
 *  don't break it; editing the line's words does — the hook sweeps such
 *  orphans on every weave entry. */
export function lineKeyOf(cardId: string, text: string): string {
  return `${cardId}::${text.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

export interface UsedLineEntry {
  targetId: string;
  placedAt: number;
}

export type UsedLineMap = Record<string, UsedLineEntry>;

const usedKey = (songId: string) => `cog:weave-used-${songId}`;

export function readUsedLines(songId: string): UsedLineMap {
  try {
    const raw = localStorage.getItem(usedKey(songId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as UsedLineMap) : {};
  } catch {
    return {};
  }
}

export function writeUsedLines(songId: string, map: UsedLineMap): void {
  try {
    localStorage.setItem(usedKey(songId), JSON.stringify(map));
  } catch {
    /* storage full/blocked — dimming is presentation state, never fatal */
  }
}
