/**
 * Spoken music-cue parser for capture transcripts.
 *
 * A songwriter often says the musical scaffolding out loud while sketching —
 * "key of G", "about a hundred and twenty BPM", "chords are G C D". This module
 * pulls those cues out of the transcript so the idea arrives song-ready (key,
 * tempo, chords prefilled) with almost no typing.
 *
 * Pure data in, pure data out — no React, no DOM, no async. Safe for workers
 * and unit tests.
 *
 * Design bias: **under-detect rather than mis-detect.** A wrong chip is worse
 * than a missing one, so bare single-letter chords are only captured inside an
 * explicit "chord(s)/progression" cue; elsewhere a token must be unambiguously
 * a chord (accidental, quality, extension, or slash, with an upper-case root).
 */

import type { TranscriptWord } from "./transcriptModel";

export interface KeyCue {
  /** Canonical key, e.g. "G", "Eb", "F# minor". */
  key: string;
  atMs: number;
}

export interface TempoCue {
  bpm: number;
  atMs: number;
}

export interface ChordCue {
  /** Canonical chord, e.g. "G", "Am", "C#m7", "G/B". */
  chord: string;
  atMs: number;
}

export interface MusicCues {
  key?: KeyCue;
  tempo?: TempoCue;
  chords: ChordCue[];
}

/** Per-word view that keeps the original casing (chords are case-sensitive). */
interface Tok {
  raw: string; // punctuation-stripped, original case
  lower: string; // lower-cased
  startMs: number;
}

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const ONES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};

const MIN_BPM = 30;
const MAX_BPM = 300;

function toToks(words: TranscriptWord[]): Tok[] {
  return words.map((w) => {
    const raw = w.text.replace(/^[^A-Za-z0-9#♯♭/]+|[^A-Za-z0-9#♯♭/]+$/g, "");
    return { raw, lower: raw.toLowerCase(), startMs: w.startMs };
  });
}

/**
 * Read a spoken or numeric number starting at `i`. Handles "120", "ninety",
 * "one hundred twenty", "a hundred and ten". Returns the value + tokens used.
 */
function parseNumber(
  toks: Tok[],
  i: number,
): { value: number; consumed: number } | null {
  const t0 = toks[i]?.lower;
  if (!t0) return null;

  // Pure digits.
  if (/^\d{1,3}$/.test(t0)) {
    return { value: Number(t0), consumed: 1 };
  }

  let value = 0;
  let consumed = 0;

  // Optional hundreds: "a hundred", "one hundred", "two hundred".
  const asOnes = ONES[t0];
  if ((t0 === "a" || asOnes != null) && toks[i + 1]?.lower === "hundred") {
    value += (t0 === "a" ? 1 : asOnes) * 100;
    consumed += 2;
  } else if (t0 === "hundred") {
    value += 100;
    consumed += 1;
  }

  let j = i + consumed;
  // Optional "and" between hundreds and the remainder.
  if (consumed > 0 && toks[j]?.lower === "and") j += 1;

  // Tens (+ optional ones) or a bare ones/teens word.
  const tw = toks[j]?.lower;
  if (tw && TENS[tw] != null) {
    value += TENS[tw];
    j += 1;
    const ow = toks[j]?.lower;
    if (ow && ONES[ow] != null && ONES[ow] < 10) {
      value += ONES[ow];
      j += 1;
    }
  } else if (tw && ONES[tw] != null) {
    value += ONES[tw];
    j += 1;
  }

  consumed = j - i;
  if (consumed === 0 || value === 0) return null;
  return { value, consumed };
}

const ACCIDENTAL_WORD: Record<string, string> = {
  sharp: "#",
  flat: "b",
};

const QUALITY = /^(m|min|minor|maj|major|dim|aug|sus2|sus4|sus|add)?(2|4|5|6|7|9|11|13)?$/;

/**
 * Try to read a chord starting at token `i`. When `requireQualified` is true the
 * chord must be unambiguous (accidental / quality / extension / slash AND an
 * upper-case root) — used outside an explicit chord cue to avoid tagging lyrics.
 */
function parseChordAt(
  toks: Tok[],
  i: number,
  requireQualified: boolean,
): { chord: string; consumed: number } | null {
  const t = toks[i];
  if (!t || t.raw.length === 0) return null;

  const rootMatch = /^([A-Ga-g])([#b♯♭])?(.*)$/.exec(t.raw);
  if (!rootMatch) return null;
  const rootUpper = rootMatch[1].toUpperCase();
  const rootIsUpper = rootMatch[1] === rootUpper;

  let accidental = rootMatch[2] ?? "";
  if (accidental === "♯") accidental = "#";
  if (accidental === "♭") accidental = "b";
  let rest = rootMatch[3];
  let consumed = 1;
  let hasAccidental = accidental.length > 0;

  // Two-word accidental: "B flat", "F sharp".
  if (!accidental && rest === "" && toks[i + 1] && ACCIDENTAL_WORD[toks[i + 1].lower]) {
    accidental = ACCIDENTAL_WORD[toks[i + 1].lower];
    hasAccidental = true;
    consumed += 1;
  }

  // Optional slash bass: "G/B" or split "G slash B".
  let slash = "";
  let hasSlash = false;
  const slashInRest = /\/([A-Ga-g])([#b]?)$/.exec(rest);
  if (slashInRest) {
    slash = `/${slashInRest[1].toUpperCase()}${slashInRest[2]}`;
    rest = rest.replace(/\/[A-Ga-g][#b]?$/, "");
    hasSlash = true;
  }

  // Normalise quality/extension tail.
  const tail = rest.toLowerCase();
  if (!QUALITY.test(tail)) return null;
  const hasQuality = tail.length > 0;

  const qualified = hasAccidental || hasQuality || hasSlash;
  if (requireQualified && (!qualified || !rootIsUpper)) return null;

  // Canonical quality casing: keep "m"/extensions lower, "maj"/"dim"/"aug"/"sus"/"add" lower.
  const chord = `${rootUpper}${accidental}${tail}${slash}`;
  return { chord, consumed };
}

const CHORD_CUE = new Set(["chord", "chords", "progression", "changes"]);
const CHORD_CONNECTOR = new Set(["and", "then", "to", "is", "are", "a", "the", "of"]);

function detectKey(toks: Tok[]): KeyCue | undefined {
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i].lower;
    let rootIdx = -1;
    let atMs = toks[i].startMs;

    if (t === "key") {
      // "key of G", "key is E flat" — skip a following "of"/"is".
      let j = i + 1;
      if (toks[j]?.lower === "of" || toks[j]?.lower === "is") j += 1;
      rootIdx = j;
    } else if (t === "in" && /^[A-Ga-g]/.test(toks[i + 1]?.raw ?? "")) {
      // "in G major" / "in E flat minor" — only with an explicit quality word
      // two/three tokens out, so plain "in my heart" never matches.
      const q1 = toks[i + 2]?.lower;
      const q2 = toks[i + 3]?.lower;
      const hasQuality =
        q1 === "major" || q1 === "minor" ||
        ((q1 === "sharp" || q1 === "flat") && (q2 === "major" || q2 === "minor"));
      if (!hasQuality) continue;
      rootIdx = i + 1;
      atMs = toks[i + 1].startMs;
    } else {
      continue;
    }

    const noteTok = toks[rootIdx];
    if (!noteTok || !/^[A-Ga-g]$/.test(noteTok.raw)) continue;
    let key = noteTok.raw.toUpperCase();
    let j = rootIdx + 1;
    // accidental
    if (ACCIDENTAL_WORD[toks[j]?.lower]) {
      key += ACCIDENTAL_WORD[toks[j].lower];
      j += 1;
    }
    // quality
    if (toks[j]?.lower === "minor") {
      key += " minor";
    } else if (toks[j]?.lower === "major") {
      key += " major";
    }
    return { key, atMs };
  }
  return undefined;
}

function detectTempo(toks: Tok[]): TempoCue | undefined {
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i].lower;

    // "tempo [of/is] <num>"
    if (t === "tempo") {
      let j = i + 1;
      if (toks[j]?.lower === "of" || toks[j]?.lower === "is") j += 1;
      const n = parseNumber(toks, j);
      if (n && n.value >= MIN_BPM && n.value <= MAX_BPM) {
        return { bpm: n.value, atMs: toks[i].startMs };
      }
    }

    // "<num> bpm" / "<num> beats per minute"
    const n = parseNumber(toks, i);
    if (n && n.value >= MIN_BPM && n.value <= MAX_BPM) {
      const after = toks[i + n.consumed]?.lower;
      const after2 = toks[i + n.consumed + 1]?.lower;
      if (after === "bpm" || (after === "beats" && after2 === "per")) {
        return { bpm: n.value, atMs: toks[i].startMs };
      }
    }
  }
  return undefined;
}

function detectChords(toks: Tok[]): ChordCue[] {
  const chords: ChordCue[] = [];

  for (let i = 0; i < toks.length; ) {
    const lower = toks[i].lower;

    // Explicit cue: "chords are G C D", "progression: G C D".
    if (CHORD_CUE.has(lower)) {
      let j = i + 1;
      let misses = 0;
      while (j < toks.length && misses < 2 && chords.length < 12) {
        if (CHORD_CONNECTOR.has(toks[j].lower)) {
          j += 1;
          continue;
        }
        const c = parseChordAt(toks, j, false);
        if (c) {
          chords.push({ chord: c.chord, atMs: toks[j].startMs });
          j += c.consumed;
          misses = 0;
        } else {
          misses += 1;
          j += 1;
        }
      }
      i = j;
      continue;
    }

    // Qualified chord anywhere ("Am", "C#", "G7", "F#m", "G/B").
    const c = parseChordAt(toks, i, true);
    if (c) {
      chords.push({ chord: c.chord, atMs: toks[i].startMs });
      i += c.consumed;
      continue;
    }
    i += 1;
  }

  // Drop immediate duplicates (a held chord transcribed twice).
  return chords.filter((c, idx) => idx === 0 || c.chord !== chords[idx - 1].chord);
}

/** Extract key / tempo / chord cues spoken inside a capture transcript. */
export function detectMusicCues(words: TranscriptWord[]): MusicCues {
  const toks = toToks(words);
  return {
    key: detectKey(toks),
    tempo: detectTempo(toks),
    chords: detectChords(toks),
  };
}
