/**
 * Word suggestions — the craft toolkit's thesaurus tool (Line Lab's engine).
 *
 * Three lenses over a seed word: perfect rhymes, near rhymes, related words —
 * the working set of every songwriter's reference (RhymeZone's three core
 * tabs). Powered by Datamuse (free, keyless, CORS-open); results are cached
 * per (seed, lens) for the session so re-opening a lens is instant and the
 * API is never hammered.
 *
 * SUGGEST, NEVER REPLACE: this returns WORDS the writer may choose — it never
 * writes a line. Offline (or on any API failure) callers fall back to
 * `suggestFromCorpus`, which mines rhymes from the writer's OWN words with
 * the on-device classifier — the tool degrades toward the writer, not toward
 * an error wall.
 *
 * Owned by C3 (craft toolkit); born in the Weave pass. docs/WEAVE-CONTRACT.md §7.
 */

import { classifyRhyme } from "@/lib/lyrics/rhyme";
import { countSyllables } from "@/lib/lyrics/syllables";

export type SuggestLens = "rhyme" | "near" | "related";

export interface WordSuggestion {
  word: string;
  syllables: number;
}

const LENS_PARAM: Record<SuggestLens, string> = {
  rhyme: "rel_rhy",
  near: "rel_nry",
  related: "ml",
};

const MAX_RESULTS = 18;

const cache = new Map<string, WordSuggestion[]>();

/** The seed Line Lab works from: the line's rhyme-bearing last word. Keeps
 *  inner hyphens ("heaven-sent") so the query matches what the swap replaces. */
export function seedFromText(line: string): string {
  const words = line
    .replace(/\[[^\]]*\]/g, " ")
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^a-z'-]/g, "").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return words.length > 0 ? words[words.length - 1] : "";
}

/**
 * Fetch suggestions for a seed through one lens. Throws on network failure —
 * callers catch and fall back to `suggestFromCorpus`. Single words only
 * (multi-word phrases don't swap cleanly into a lyric line).
 */
export async function suggestWords(
  seed: string,
  lens: SuggestLens,
  signal?: AbortSignal,
): Promise<WordSuggestion[]> {
  const clean = seed.toLowerCase().replace(/[^a-z']/g, "");
  if (!clean) return [];
  const key = `${lens}:${clean}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const url = `https://api.datamuse.com/words?${LENS_PARAM[lens]}=${encodeURIComponent(clean)}&max=${MAX_RESULTS * 2}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`datamuse ${res.status}`);
  const rows = (await res.json()) as Array<{ word?: string }>;

  const seen = new Set<string>();
  const out: WordSuggestion[] = [];
  for (const row of rows) {
    const word = (row.word ?? "").trim().toLowerCase();
    if (!word || word.includes(" ") || word === clean || seen.has(word)) continue;
    if (!/^[a-z][a-z'-]*$/.test(word)) continue;
    seen.add(word);
    out.push({ word, syllables: countSyllables(word) });
    if (out.length >= MAX_RESULTS) break;
  }
  cache.set(key, out);
  return out;
}

/**
 * Offline fallback: rhyming words mined from the writer's own material with
 * the on-device classifier. `corpus` is any bag of words (e.g. every word in
 * the song's idea cards); perfect rhymes rank before slant.
 */
export function suggestFromCorpus(seed: string, corpus: string[]): WordSuggestion[] {
  const clean = seed.toLowerCase().replace(/[^a-z']/g, "");
  if (!clean) return [];
  const seen = new Set<string>();
  const perfect: WordSuggestion[] = [];
  const slant: WordSuggestion[] = [];
  for (const raw of corpus) {
    const word = raw.toLowerCase().replace(/[^a-z']/g, "");
    if (!word || word === clean || seen.has(word)) continue;
    seen.add(word);
    const kind = classifyRhyme(word, clean);
    if (kind === "perfect") perfect.push({ word, syllables: countSyllables(word) });
    else if (kind === "slant") slant.push({ word, syllables: countSyllables(word) });
  }
  return [...perfect, ...slant].slice(0, MAX_RESULTS);
}

/** Every word across a set of text bodies — corpus for the offline fallback. */
export function corpusFromBodies(bodies: string[]): string[] {
  const words: string[] = [];
  for (const body of bodies) {
    for (const raw of body.replace(/\[[^\]]*\]/g, " ").split(/\s+/)) {
      const w = raw.toLowerCase().replace(/[^a-z']/g, "");
      if (w.length >= 2) words.push(w);
    }
  }
  return words;
}
