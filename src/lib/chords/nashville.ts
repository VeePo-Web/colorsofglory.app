/**
 * Nashville Number System engine.
 *
 * Storage shape is always {degree, accidental, quality, extension, bass}.
 * Rendering converts to letters for a given key + mode at display time, so
 * one-tap transpose is free: only the key changes; the numbers don't move.
 */

import {
  type Mode,
  type Accidental,
  SCALE,
  DIATONIC_QUALITY,
  pitchClass,
  pcToLetter,
  keyAccidental,
} from "./keys";

export type Degree = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ChordQuality =
  | "maj" | "min" | "dim" | "aug"
  | "sus2" | "sus4";

export type ChordExtension =
  | "7" | "maj7" | "m7" | "9" | "add9" | "13";

export type NumberChord = {
  degree: Degree;
  accidental?: Accidental;
  quality: ChordQuality;
  extension?: ChordExtension;
  bass?: { degree: Degree; accidental?: Accidental };
};

export type Progression = {
  key: string;          // tonic letter at time of capture (round-trip safety)
  mode: Mode;
  chords: NumberChord[]; // flat list — bars/repeats are a v2
};

/** Quality suffix when rendered as a letter chord. */
const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: "",
  min: "m",
  dim: "°",
  aug: "+",
  sus2: "sus2",
  sus4: "sus4",
};

/** Quality suffix when rendered as a number chord. */
const QUALITY_SUFFIX_NUM: Record<ChordQuality, string> = {
  maj: "",
  min: "m",
  dim: "°",
  aug: "+",
  sus2: "sus2",
  sus4: "sus4",
};

/** Pitch class of a degree (with optional accidental) inside a key+mode. */
function degreePC(
  tonic: string,
  mode: Mode,
  degree: Degree,
  accidental?: Accidental,
): number {
  const tonicPC = pitchClass(tonic.replace(/m$/, ""));
  const interval = SCALE[mode][degree - 1];
  const acc = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  return ((tonicPC + interval + acc) % 12 + 12) % 12;
}

/** Render a single NumberChord as a letter chord in the given key. */
export function chordToLetters(
  chord: NumberChord,
  tonic: string,
  mode: Mode = "major",
): string {
  const prefer = keyAccidental(tonic, mode);
  const rootPC = degreePC(tonic, mode, chord.degree, chord.accidental);
  const root = pcToLetter(rootPC, prefer);

  const suffix = QUALITY_SUFFIX[chord.quality];
  const ext = chord.extension ?? "";

  let out = `${root}${suffix}${ext}`;
  if (chord.bass) {
    const bassPC = degreePC(tonic, mode, chord.bass.degree, chord.bass.accidental);
    out += `/${pcToLetter(bassPC, prefer)}`;
  }
  return out;
}

/** Render a single NumberChord as a Nashville number ("1", "6m", "b7", "4/5"). */
export function chordToNumbers(chord: NumberChord, mode: Mode = "major"): string {
  const defaultQuality = DIATONIC_QUALITY[mode][chord.degree - 1] as string;
  const q = chord.quality as string;
  // Display quality only when it differs from the diatonic default,
  // or when it's non-triadic (sus2/sus4/aug). Keeps chips clean.
  const nonTriadic = q === "sus2" || q === "sus4" || q === "aug";
  const showQuality = q !== defaultQuality || nonTriadic;

  const prefix = chord.accidental ?? "";
  const suffix = showQuality ? QUALITY_SUFFIX_NUM[chord.quality] : "";
  const ext = chord.extension ?? "";

  let out = `${prefix}${chord.degree}${suffix}${ext}`;
  if (chord.bass) {
    out += `/${chord.bass.accidental ?? ""}${chord.bass.degree}`;
  }
  return out;
}

/** Build a default NumberChord for a diatonic degree. */
export function diatonicChord(degree: Degree, mode: Mode = "major"): NumberChord {
  return { degree, quality: DIATONIC_QUALITY[mode][degree - 1] };
}

/** The 7 diatonic chords for the given mode. */
export function diatonic(mode: Mode = "major"): NumberChord[] {
  return ([1, 2, 3, 4, 5, 6, 7] as Degree[]).map((d) => diatonicChord(d, mode));
}

/** Common non-diatonic / borrowed chords offered behind "+ more…". */
export function borrowedChords(mode: Mode = "major"): NumberChord[] {
  if (mode === "major") {
    return [
      { degree: 7, accidental: "b", quality: "maj" }, // bVII (e.g. F in G)
      { degree: 3, accidental: "b", quality: "maj" }, // bIII
      { degree: 6, accidental: "b", quality: "maj" }, // bVI
      { degree: 2, accidental: "b", quality: "maj" }, // bII
      { degree: 4, quality: "min" },                  // iv (minor four)
      { degree: 1, quality: "maj", extension: "7" },  // I7
      { degree: 5, quality: "maj", extension: "7" },  // V7
    ];
  }
  return [
    { degree: 7, quality: "maj" },                    // raised VII (harmonic minor V resolution)
    { degree: 5, quality: "maj" },                    // V (dominant)
    { degree: 4, quality: "maj" },                    // IV (Dorian color)
    { degree: 6, quality: "maj" },                    // VI
    { degree: 1, quality: "maj" },                    // Picardy
  ];
}

/** Render an entire progression as space-separated letters in the given key. */
export function progressionToLetters(
  progression: Progression,
  displayKey?: string,
  displayMode?: Mode,
): string {
  const k = displayKey ?? progression.key;
  const m = displayMode ?? progression.mode;
  return progression.chords.map((c) => chordToLetters(c, k, m)).join(" ");
}

/** Render an entire progression as space-separated Nashville numbers. */
export function progressionToNumbers(progression: Progression): string {
  return progression.chords.map((c) => chordToNumbers(c, progression.mode)).join(" ");
}

/**
 * "Transpose" is a no-op on the stored numbers — that's the whole point.
 * This helper just stamps a new key onto the progression and returns it,
 * so callers can persist the move atomically.
 */
export function transpose(progression: Progression, toKey: string, toMode?: Mode): Progression {
  return { ...progression, key: toKey, mode: toMode ?? progression.mode };
}

/** Equality helper for chord chips. */
export function chordsEqual(a: NumberChord, b: NumberChord): boolean {
  return (
    a.degree === b.degree &&
    (a.accidental ?? null) === (b.accidental ?? null) &&
    a.quality === b.quality &&
    (a.extension ?? null) === (b.extension ?? null) &&
    ((a.bass?.degree ?? null) === (b.bass?.degree ?? null)) &&
    ((a.bass?.accidental ?? null) === (b.bass?.accidental ?? null))
  );
}