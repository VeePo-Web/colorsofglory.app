/**
 * Rhyme analysis — the craft toolkit's rhyme tool.
 *
 * Rhyme is the single most-used songwriting reference (RhymeZone, MasterWriter,
 * Rhyme Desk all center on perfect / near / slant rhyme), and rhyme-scheme
 * highlighting is a loved feature (Lazyjot, Song Cage). This works on the
 * writer's OWN words — no bundled dictionary, no network — so it ships zero
 * dependencies and never leaves the device: classify two words, or label a
 * section's rhyme scheme (A/B/A/B) from its line endings.
 *
 * HEURISTIC, spelling-based (English). It nails the common worship/pop cases
 * but is not a pronunciation dictionary — eye-rhymes and unusual spellings
 * (heart/start read as slant; rhyme/time can miss on y-vs-i) are known limits.
 * It is guidance for the writer's ear, never a correctness gate.
 *
 * Pure functions only. No React, no I/O.
 */

export type RhymeKind = "perfect" | "slant" | "assonance" | "none";

const CHORD_TOKEN = /\[[^\]]*\]/g;

function clean(word: string): string {
  return word.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * The rhyming tail of a word: from its last sounded vowel to the end, with
 * doubled vowels collapsed (so "see"/"me" align) and a silent terminal "e"
 * dropped (so "grace"/"place" align). Empty string for non-words.
 */
export function rhymeKey(word: string): string {
  let s = clean(word);
  if (!s) return "";

  // Collapse runs of the same vowel: "ee" -> "e", "oo" -> "o".
  s = s.replace(/([aeiou])\1+/g, "$1");

  // Drop a silent terminal "e" after a consonant — but only if a vowel remains.
  if (/[^aeiouy]e$/.test(s) && /[aeiouy]/.test(s.slice(0, -1))) {
    s = s.slice(0, -1);
  }

  // Tail = from the last vowel cluster onward.
  const match = [...s.matchAll(/[aeiouy]+/g)];
  if (match.length === 0) return s;
  const last = match[match.length - 1];
  return s.slice(last.index);
}

/** Split a rhyme key into its vowel nucleus and trailing consonant coda. */
function split(key: string): { vowel: string; coda: string } {
  const m = key.match(/^([aeiouy]+)([a-z]*)$/);
  return m ? { vowel: m[1], coda: m[2] } : { vowel: "", coda: key };
}

/** Classify how two words rhyme. Identical words are identity, not rhyme. */
export function classifyRhyme(a: string, b: string): RhymeKind {
  const ca = clean(a);
  const cb = clean(b);
  if (!ca || !cb || ca === cb) return "none";

  const ka = rhymeKey(a);
  const kb = rhymeKey(b);
  if (ka && ka === kb) return "perfect";

  const sa = split(ka);
  const sb = split(kb);
  if (sa.coda && sa.coda === sb.coda && sa.vowel !== sb.vowel) return "slant";
  if (sa.vowel && sa.vowel === sb.vowel && sa.coda !== sb.coda) return "assonance";
  return "none";
}

/** The rhyme-bearing last word of a line, with chords + punctuation stripped. */
export function lastWord(line: string): string {
  const words = line.replace(CHORD_TOKEN, " ").split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const w = clean(words[i]);
    if (w) return w;
  }
  return "";
}

/**
 * Label each line A/B/C… by the rhyme class of its ending. Lines with no
 * rhyme-bearing word are marked "-". The output lines up with the input.
 */
export function rhymeScheme(lines: string[]): string[] {
  const labelFor = new Map<string, string>();
  let next = 0;
  return lines.map((line) => {
    const key = rhymeKey(lastWord(line));
    if (!key) return "-";
    if (!labelFor.has(key)) {
      labelFor.set(key, String.fromCharCode(65 + (next % 26)));
      next++;
    }
    return labelFor.get(key) as string;
  });
}
