/**
 * "Easy keys" — capo suggestions. Given the key a song sounds in, find the
 * capo positions that let a guitarist play in open-chord-friendly shapes
 * (Ultimate Guitar's "simplify", OnSong's capo helper). E.g. a song in Bb →
 * Capo 1 to play in A, or Capo 3 to play in G.
 *
 * Pure. Reuses the transpose engine — capo just transposes the play key down.
 */

import { transposeKeyLetter } from "./sheet";
import type { Mode } from "./keys";

// Open-chord-friendly keys, easiest first.
const EASY_MAJOR = ["C", "G", "D", "A", "E"];
const EASY_MINOR = ["Em", "Am", "Dm", "Bm"];

export interface CapoSuggestion {
  capo: number;
  playKey: string; // the key you're playing shapes in with that capo
}

/**
 * Up to three capo suggestions for `tonic` (a key letter; trailing "m" ok).
 * If the song key is already easy, returns a single { capo: 0 } entry.
 */
export function suggestCapos(tonic: string, mode: Mode = "major"): CapoSuggestion[] {
  const root = tonic.replace(/m$/, "");
  const easy = mode === "minor" ? EASY_MINOR : EASY_MAJOR;
  const labelOf = (letter: string) => (mode === "minor" ? `${letter}m` : letter);
  const isEasy = (letter: string) => easy.includes(labelOf(letter));

  if (isEasy(root)) return [{ capo: 0, playKey: root }];

  const out: CapoSuggestion[] = [];
  const seen = new Set<string>();
  for (let capo = 1; capo <= 7; capo++) {
    const playKey = transposeKeyLetter(root, mode, -capo);
    if (isEasy(playKey) && !seen.has(playKey)) {
      seen.add(playKey);
      out.push({ capo, playKey });
    }
  }
  return out.slice(0, 3);
}
