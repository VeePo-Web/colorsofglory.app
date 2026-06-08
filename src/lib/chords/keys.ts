/**
 * Keys + enharmonic spelling for the Nashville engine.
 * Sharp keys spell black-keys as #; flat keys spell them as b.
 */

export type Mode = "major" | "minor";
export type Accidental = "b" | "#";

export const NOTES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export const NOTES_FLAT  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

/** Pitch class (0-11) for a given letter name. Accepts e.g. "C", "C#", "Db", "Bb". */
export function pitchClass(letter: string): number {
  const m = letter.trim().match(/^([A-Ga-g])([b#])?$/);
  if (!m) return -1;
  const base = "C_D_EF_G_A_B".indexOf(m[1].toUpperCase());
  if (base < 0) return -1;
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return ((base + acc) % 12 + 12) % 12;
}

/** Major-key tonics in standard spelling. */
export const MAJOR_KEYS = ["C", "G", "D", "A", "E", "B", "F#", "F", "Bb", "Eb", "Ab", "Db"] as const;
/** Minor-key tonics in standard spelling. */
export const MINOR_KEYS = ["Am", "Em", "Bm", "F#m", "C#m", "G#m", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"] as const;

/** Returns "sharp" or "flat" preference for a key's spelling. */
export function keyAccidental(tonic: string, mode: Mode): "sharp" | "flat" {
  // Minor key shares signature with its relative major (tonic + 3 semitones).
  const root = tonic.replace(/m$/, "");
  if (mode === "minor") {
    const sharpRelMinors = ["Em", "Bm", "F#m", "C#m", "G#m", "D#m", "A#m"];
    const flatRelMinors  = ["Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm"];
    if (sharpRelMinors.includes(tonic)) return "sharp";
    if (flatRelMinors.includes(tonic))  return "flat";
    return "sharp"; // Am is neutral; treat as sharp (no accidentals anyway)
  }
  const flats = ["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
  return flats.includes(root) ? "flat" : "sharp";
}

export function pcToLetter(pc: number, prefer: "sharp" | "flat"): string {
  const tbl = prefer === "flat" ? NOTES_FLAT : NOTES_SHARP;
  return tbl[((pc % 12) + 12) % 12];
}

/** Major / minor scale intervals from tonic. */
export const SCALE: Record<Mode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10], // natural minor
};

/** Default quality for each scale degree of the given mode. */
export const DIATONIC_QUALITY: Record<Mode, Array<"maj" | "min" | "dim">> = {
  major: ["maj", "min", "min", "maj", "maj", "min", "dim"],
  minor: ["min", "dim", "maj", "min", "min", "maj", "maj"],
};