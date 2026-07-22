/**
 * Live Rhyme Schemer — the palette engine (C3, the craft toolkit).
 *
 * While brainstorming, the writer's line ends in a word; this returns a calm,
 * grouped palette of candidates — perfect / near·slant / related / PHRASE —
 * ranked by a composite of phonetic tier, the song's THEME + SCRIPTURE
 * context, meter fit, and Datamuse's own frequency score. It SURFACES the
 * writer's options; it never writes a line (docs/RHYME-CONTRACT.md).
 *
 * Craft grounding (RhymeZone / MasterWriter / B-Rhymes):
 *   - slant/near rhymes rank nearly as high as perfect — real worship writing
 *     leans on them; corny perfect rhymes are not the goal;
 *   - multi-word PHRASE rhymes are kept (Datamuse rarely returns them, so they
 *     are also MINED from the writer's own lines — "the waiting" / "creation");
 *   - the theme biases at the SOURCE (Datamuse `topics=`) and again in the
 *     re-rank; when the writer sets no theme, the song's OWN frequent words
 *     stand in as the theme so the tool is on-message with zero setup.
 *
 * SAFETY LADDER (never breaks the editor): `suggestPalette` throws only when
 * every fetch failed — callers catch and fall back to `paletteFromCorpus`
 * (on-device, from the writer's own words), and to silence after that. All of
 * this runs off the input path; the lyrics editor never waits on it.
 */

import { classifyRhyme, lastWord } from "@/lib/lyrics/rhyme";
import { countSyllables, countLineSyllables } from "@/lib/lyrics/syllables";

export type RhymeTier = "perfect" | "nearSlant" | "related";

export interface RhymeCandidate {
  text: string;
  syllables: number;
  tier: RhymeTier;
  phrase: boolean;
  themeHit: boolean;
  score: number;
}

export interface RhymePaletteGroups {
  perfect: RhymeCandidate[];
  nearSlant: RhymeCandidate[];
  related: RhymeCandidate[];
  phrase: RhymeCandidate[];
}

export interface RhymeContext {
  /** Free words the writer typed as the song's theme ("grace mercy morning"). */
  theme: string;
  /** Attached passages — label ("Psalm 23:1–3") + the passage text. */
  scriptures: Array<{ label: string; text: string }>;
}

export const EMPTY_RHYME_CONTEXT: RhymeContext = { theme: "", scriptures: [] };

/** Shared options: the line the seed came from + its meter target + the
 *  auto-theme boost words (the song's own frequent words when no theme is set)
 *  + the song's lines (for mining phrase rhymes). */
export interface PaletteOpts {
  lineText?: string;
  meterTarget?: number;
  boostWords?: string[];
  songLines?: string[];
  signal?: AbortSignal;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z']/g, "");

/** Words too common to carry theme signal. Small on purpose. */
const STOPWORDS = new Set([
  "the", "and", "a", "an", "of", "in", "on", "to", "for", "is", "are", "was",
  "were", "be", "been", "am", "i", "you", "he", "she", "it", "we", "they",
  "my", "your", "his", "her", "its", "our", "their", "me", "him", "them",
  "that", "this", "these", "those", "with", "as", "at", "by", "from", "but",
  "or", "not", "no", "so", "if", "then", "than", "there", "here", "will",
  "shall", "have", "has", "had", "do", "does", "did", "when", "who", "whom",
  "which", "what", "all", "any", "each", "every", "unto", "thee", "thou",
  "thy", "ye", "o", "up", "down", "out", "into", "over", "under",
]);

function contentWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z']+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/**
 * The song's most-frequent content words — the auto-theme used to bias the
 * ranking when the writer has set no explicit theme or scripture. Zero setup:
 * the song's own vocabulary IS its theme.
 */
export function frequentContentWords(lines: string[], limit = 12): string[] {
  const freq = new Map<string, number>();
  for (const line of lines) {
    for (const w of contentWords(line)) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w).slice(0, limit);
}

/** The theme/scripture word set that biases the re-rank, plus any auto-theme
 *  fallback words (the song's own) when no explicit theme was set. */
export function contextWordSet(ctx: RhymeContext, fallback: string[] = []): Set<string> {
  const set = new Set<string>();
  for (const w of contentWords(ctx.theme)) set.add(w);
  for (const s of ctx.scriptures) {
    for (const w of contentWords(s.text)) set.add(w);
    for (const w of contentWords(s.label)) set.add(w);
  }
  for (const w of fallback) set.add(w);
  return set;
}

/**
 * Up to five topic words for Datamuse `topics=` (its documented cap). Theme
 * words lead (the writer chose them); scripture content words fill by
 * frequency; the auto-theme fallback fills anything still empty.
 */
export function contextTopics(ctx: RhymeContext, fallback: string[] = []): string[] {
  const topics: string[] = [];
  const push = (w: string) => {
    if (!topics.includes(w) && topics.length < 5) topics.push(w);
  };
  for (const w of contentWords(ctx.theme)) push(w);
  if (topics.length < 5) {
    const freq = new Map<string, number>();
    for (const s of ctx.scriptures) {
      for (const w of contentWords(s.text)) freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    for (const [w] of [...freq.entries()].sort((a, b) => b[1] - a[1])) push(w);
  }
  for (const w of fallback) push(w);
  return topics;
}

// ── Ranking ──────────────────────────────────────────────────────────────────

/** Slant/near stays close to perfect on purpose (B-Rhymes' insight). */
const TIER_WEIGHT: Record<RhymeTier, number> = {
  perfect: 1.0,
  nearSlant: 0.95,
  related: 0.55,
};

/** Multi-word rhymes are often the best pick — a quiet nudge, not a takeover. */
const PHRASE_BONUS = 1.05;
const THEME_BOOST = 0.65;
const STEM_BOOST = 0.25;

interface RawCandidate {
  text: string;
  /** Datamuse relevance score for its lens (0 when absent). */
  dmScore: number;
  numSyllables?: number;
  lens: "rhyme" | "near" | "related";
}

function tierFor(candidate: string, seed: string, lens: RawCandidate["lens"]): RhymeTier {
  const end = lastWord(candidate);
  const kind = classifyRhyme(end, seed);
  if (kind === "perfect") return "perfect";
  if (kind === "slant" || kind === "assonance") return "nearSlant";
  // The classifier is a spelling heuristic — trust the lens when it disagrees
  // (Datamuse has real pronunciation data; "rhyme"/"time" style misses land
  // in the tier their lens promised, never dropped).
  return lens === "rhyme" ? "perfect" : lens === "near" ? "nearSlant" : "related";
}

function themeHitFor(candidate: string, ctxWords: Set<string>): { hit: boolean; stem: boolean } {
  const words = contentWords(candidate);
  let stem = false;
  for (const w of words) {
    if (ctxWords.has(w)) return { hit: true, stem: false };
    for (const c of ctxWords) {
      if (w.length >= 4 && c.length >= 4 && (w.startsWith(c.slice(0, 4)) || c.startsWith(w.slice(0, 4)))) {
        stem = true;
      }
    }
  }
  return { hit: false, stem };
}

/**
 * Composite rank: phonetic tier x theme/scripture closeness x meter fit x
 * normalized Datamuse score. `meterTarget` is the syllable count a finished
 * line "wants" (a parallel line's count); candidates that would land the line
 * on it get a quiet lift. Pure — unit-tested directly.
 */
export function rankCandidates(
  raw: RawCandidate[],
  seed: string,
  ctx: RhymeContext,
  opts: PaletteOpts = {},
): RhymeCandidate[] {
  const ctxWords = contextWordSet(ctx, opts.boostWords ?? []);
  const maxScore = Math.max(1, ...raw.map((r) => r.dmScore));
  const seedSyllables = countSyllables(seed);
  const lineSyllables = opts.lineText ? countLineSyllables(opts.lineText) : 0;

  const seen = new Set<string>();
  const out: RhymeCandidate[] = [];
  for (const r of raw) {
    const text = r.text.trim().toLowerCase();
    if (!text || text === seed || seen.has(text)) continue;
    if (!/^[a-z][a-z' -]*$/.test(text)) continue;
    seen.add(text);

    const phrase = text.includes(" ");
    const tier = tierFor(text, seed, r.lens);
    const syllables = r.numSyllables && r.numSyllables > 0 ? r.numSyllables : countSyllables(text);
    const { hit, stem } = themeHitFor(text, ctxWords);

    let score = TIER_WEIGHT[tier];
    if (phrase) score *= PHRASE_BONUS;
    if (hit) score *= 1 + THEME_BOOST;
    else if (stem) score *= 1 + STEM_BOOST;
    if (opts.meterTarget && opts.lineText) {
      const finished = lineSyllables - seedSyllables + syllables;
      const off = Math.abs(finished - opts.meterTarget);
      if (off === 0) score *= 1.15;
      else if (off === 1) score *= 1.05;
    }
    score *= 0.75 + 0.25 * (r.dmScore / maxScore);

    out.push({ text, syllables, tier, phrase, themeHit: hit, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

const GROUP_CAPS = { perfect: 10, nearSlant: 10, related: 8, phrase: 8 } as const;

/** Split ranked candidates into the four calm display groups. */
export function groupPalette(ranked: RhymeCandidate[]): RhymePaletteGroups {
  const groups: RhymePaletteGroups = { perfect: [], nearSlant: [], related: [], phrase: [] };
  for (const c of ranked) {
    const bucket = c.phrase ? groups.phrase : groups[c.tier];
    const cap = c.phrase ? GROUP_CAPS.phrase : GROUP_CAPS[c.tier];
    if (bucket.length < cap) bucket.push(c);
  }
  return groups;
}

export function paletteIsEmpty(p: RhymePaletteGroups): boolean {
  return p.perfect.length + p.nearSlant.length + p.related.length + p.phrase.length === 0;
}

// ── Phrase rhymes from the writer's own lines ────────────────────────────────

/**
 * PHRASE rhymes mined from the song's own lines: any line whose ending rhymes
 * with the seed contributes its last two words as a phrase candidate ("…the
 * waiting"). Datamuse rarely returns phrases, so without this the Phrase group
 * would sit empty — and phrases are often the best rhyme (MasterWriter's edge).
 */
export function phraseRhymesFromLines(seed: string, lines: string[]): RawCandidate[] {
  const clean = norm(seed);
  if (!clean) return [];
  const seen = new Set<string>();
  const out: RawCandidate[] = [];
  for (const line of lines) {
    const tokens = line
      .replace(/\[[^\]]*\]/g, " ")
      .split(/\s+/)
      .map((t) => t.toLowerCase().replace(/[^a-z'-]/g, "").replace(/^-+|-+$/g, ""))
      .filter(Boolean);
    if (tokens.length < 2) continue;
    const end = tokens[tokens.length - 1];
    if (!end || norm(end) === clean) continue;
    const kind = classifyRhyme(end, clean);
    if (kind === "none") continue;
    const phrase = tokens.slice(-2).join(" ").trim();
    if (!phrase.includes(" ") || seen.has(phrase)) continue;
    seen.add(phrase);
    out.push({ text: phrase, dmScore: 1, lens: kind === "perfect" ? "rhyme" : "near" });
  }
  return out;
}

/** Merge freshly-mined phrase candidates into a palette's phrase group without
 *  mutating the (cached) base. */
function mergePhrases(base: RhymePaletteGroups, phrases: RhymeCandidate[]): RhymePaletteGroups {
  if (phrases.length === 0) return base;
  const seen = new Set(base.phrase.map((c) => c.text));
  const merged = [...base.phrase];
  for (const p of phrases) {
    if (!seen.has(p.text)) {
      seen.add(p.text);
      merged.push(p);
    }
  }
  merged.sort((a, b) => b.score - a.score);
  return { ...base, phrase: merged.slice(0, GROUP_CAPS.phrase) };
}

// ── Online fetch (Datamuse) ──────────────────────────────────────────────────

interface DatamuseRow {
  word?: string;
  score?: number;
  numSyllables?: number;
}

const cache = new Map<string, RhymePaletteGroups>();
const CACHE_MAX = 80;

async function fetchLens(
  seed: string,
  param: string,
  lens: RawCandidate["lens"],
  topics: string[],
  max: number,
  signal?: AbortSignal,
): Promise<RawCandidate[]> {
  let url = `https://api.datamuse.com/words?${param}=${encodeURIComponent(seed)}&md=s&max=${max}`;
  if (topics.length > 0) url += `&topics=${encodeURIComponent(topics.join(","))}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`datamuse ${res.status}`);
  const rows = (await res.json()) as DatamuseRow[];
  return rows
    .filter((r): r is DatamuseRow & { word: string } => typeof r.word === "string" && r.word.length > 0)
    .map((r) => ({ text: r.word, dmScore: r.score ?? 0, numSyllables: r.numSyllables, lens }));
}

/**
 * The live palette: three Datamuse lenses in parallel (perfect rhymes keep
 * their multi-word PHRASE results), theme-biased at source via `topics=`,
 * then composite-ranked and grouped — and finally augmented with phrase
 * rhymes mined from the writer's own lines. The Datamuse result is
 * session-cached per (seed, topics); the mined phrases are merged fresh each
 * call (the lines change as the writer types).
 *
 * Throws ONLY when every lens failed (fully offline) — callers ladder down to
 * `paletteFromCorpus`, then to silence. Partial outages degrade quietly.
 */
export async function suggestPalette(
  seed: string,
  ctx: RhymeContext,
  opts: PaletteOpts = {},
): Promise<RhymePaletteGroups> {
  const clean = norm(seed);
  if (!clean) return { perfect: [], nearSlant: [], related: [], phrase: [] };

  const topics = contextTopics(ctx, opts.boostWords ?? []);
  const key = `${clean}|${topics.join(",")}`;
  let base = cache.get(key);
  if (!base) {
    const settled = await Promise.allSettled([
      fetchLens(clean, "rel_rhy", "rhyme", topics, 60, opts.signal),
      fetchLens(clean, "rel_nry", "near", topics, 40, opts.signal),
      fetchLens(clean, "ml", "related", topics, 30, opts.signal),
    ]);
    const raw = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
    if (raw.length === 0 && settled.every((s) => s.status === "rejected")) {
      throw new Error("rhyme_palette_offline");
    }
    base = groupPalette(rankCandidates(raw, clean, ctx, opts));
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, base);
  }

  const mined = opts.songLines?.length
    ? rankCandidates(phraseRhymesFromLines(clean, opts.songLines), clean, ctx, opts).filter((c) => c.phrase)
    : [];
  return mergePhrases(base, mined);
}

// ── Offline rung: the writer's own words ─────────────────────────────────────

/**
 * On-device fallback — rhymes mined from the writer's own material with the
 * spelling classifier, theme-ranked the same way, including phrase rhymes
 * from their own lines. No related group (the corpus has no pronunciation
 * data to trust that far).
 */
export function paletteFromCorpus(
  seed: string,
  corpus: string[],
  ctx: RhymeContext,
  opts: PaletteOpts = {},
): RhymePaletteGroups {
  const clean = norm(seed);
  if (!clean) return { perfect: [], nearSlant: [], related: [], phrase: [] };
  const seen = new Set<string>();
  const raw: RawCandidate[] = [];
  for (const rawWord of corpus) {
    const word = norm(rawWord);
    if (!word || word === clean || seen.has(word)) continue;
    seen.add(word);
    const kind = classifyRhyme(word, clean);
    if (kind === "none") continue;
    raw.push({ text: word, dmScore: 1, lens: kind === "perfect" ? "rhyme" : "near" });
  }
  const base = groupPalette(rankCandidates(raw, clean, ctx, opts));
  const mined = opts.songLines?.length
    ? rankCandidates(phraseRhymesFromLines(clean, opts.songLines), clean, ctx, opts).filter((c) => c.phrase)
    : [];
  return mergePhrases(base, mined);
}
