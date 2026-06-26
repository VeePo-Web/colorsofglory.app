/**
 * Syllable counting — the craft toolkit's prosody helper.
 *
 * Why this exists: songwriters obsess over syllable count because singability
 * lives in meter. Pattison's prosody teaches that parallel lines (verse 1 vs
 * verse 2, the matching lines of a chorus) should carry matching syllable
 * counts so the melody fits; MasterWriter and Song Cage both ship a syllable
 * counter for exactly this reason. This gives the Sheet a quiet, pull-to-open
 * count per word / per line — never an autocorrect, just a mirror.
 *
 * It is a HEURISTIC (English, vowel-group based with the silent-e / -ed / -le
 * adjustments). It is right for the vast majority of worship/pop vocabulary but
 * not a pronunciation dictionary: words where "-ed" is voiced after t/d
 * (wanted, needed) or unusual spellings (rhythm) can be off by one. It is a
 * songwriting aid, not a metronome — surface it as guidance, never a gate.
 *
 * Pure functions only. No React, no I/O.
 */

const SHORT_WORD = 3;

// Strip inline ChordPro chord tokens like [G] or [G7] before counting lyrics.
const CHORD_TOKEN = /\[[^\]]*\]/g;

/**
 * Approximate the syllable count of a single word.
 * Returns 0 for empty / punctuation-only input, otherwise at least 1.
 */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return 0;
  if (w.length <= SHORT_WORD) return 1;

  const stripped = w
    // Drop common silent endings: "-e" and "-ed" after a consonant (love, saved),
    // and "-es" after a consonant (graces) — but keep "-le" (table) since l is
    // excluded from the consonant class here.
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    // A leading "y" acts as a consonant (yes), not a vowel.
    .replace(/^y/, "");

  // Each run of adjacent vowels counts as one syllable nucleus.
  const groups = stripped.match(/[aeiouy]+/g);
  return groups ? groups.length : 1;
}

/** Total syllables across a lyric line, ignoring chords and punctuation. */
export function countLineSyllables(text: string): number {
  return wordsOf(text).reduce((sum, w) => sum + countSyllables(w), 0);
}

/** Per-word counts for in-editor highlighting. Word text is preserved as typed. */
export function syllableBreakdown(text: string): { word: string; count: number }[] {
  return wordsOf(text).map((word) => ({ word, count: countSyllables(word) }));
}

/**
 * Syllables per line across a block — the prosody view. Compare two verses or
 * the parallel lines of a chorus to see where the meter drifts. Blank lines are
 * skipped so the profile lines up with the sung lines.
 */
export function lineSyllableProfile(text: string): number[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(countLineSyllables);
}

// ─── internal ────────────────────────────────────────────────────────────────

function wordsOf(text: string): string[] {
  return text.replace(CHORD_TOKEN, " ").split(/\s+/).filter(Boolean);
}
