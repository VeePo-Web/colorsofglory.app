/**
 * Guitar chord shapes — fingerings for the chord-diagram feature (Ultimate
 * Guitar's signature). Correctness first: common open chords use curated
 * voicings; everything else falls back to movable CAGED barre shapes (E-shape
 * on the low E, A-shape on the A string) computed from the root. Returns null
 * for shapes we won't draw (dim/aug/odd extensions) so the UI degrades calmly.
 *
 * frets: 6 entries low-E → high-E. -1 = muted, 0 = open, n = fret n (absolute).
 * Pure functions. No React.
 */

import { pitchClass } from "./keys";

export interface Voicing {
  frets: number[];
  baseFret: number; // first fret the diagram window should show (1 = nut)
}

type ShapeKey = "maj" | "min" | "7" | "maj7" | "m7" | "sus4" | "sus2";

// Curated open voicings — the nice, recognizable shapes.
const OPEN: Record<string, number[]> = {
  C: [-1, 3, 2, 0, 1, 0],
  D: [-1, -1, 0, 2, 3, 2],
  E: [0, 2, 2, 1, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  G: [3, 2, 0, 0, 0, 3],
  A: [-1, 0, 2, 2, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  Em: [0, 2, 2, 0, 0, 0],
  Dm: [-1, -1, 0, 2, 3, 1],
  C7: [-1, 3, 2, 3, 1, 0],
  D7: [-1, -1, 0, 2, 1, 2],
  E7: [0, 2, 0, 1, 0, 0],
  G7: [3, 2, 0, 0, 0, 1],
  A7: [-1, 0, 2, 0, 2, 0],
  B7: [-1, 2, 1, 2, 0, 2],
  Cmaj7: [-1, 3, 2, 0, 0, 0],
  Gmaj7: [3, 2, 0, 0, 0, 2],
  Dmaj7: [-1, -1, 0, 2, 2, 2],
  Amaj7: [-1, 0, 2, 1, 2, 0],
  Am7: [-1, 0, 2, 0, 1, 0],
  Em7: [0, 2, 0, 0, 0, 0],
  Dm7: [-1, -1, 0, 2, 1, 1],
  Cadd9: [-1, 3, 2, 0, 3, 0],
  Dsus4: [-1, -1, 0, 2, 3, 3],
  Asus4: [-1, 0, 2, 2, 3, 0],
  Esus4: [0, 2, 2, 2, 0, 0],
  Dsus2: [-1, -1, 0, 2, 3, 0],
  Asus2: [-1, 0, 2, 2, 0, 0],
};

// Movable shape templates, frets relative to the root fret r.
const E_SHAPE: Record<ShapeKey, (r: number) => number[]> = {
  maj: (r) => [r, r + 2, r + 2, r + 1, r, r],
  min: (r) => [r, r + 2, r + 2, r, r, r],
  "7": (r) => [r, r + 2, r, r + 1, r, r],
  maj7: (r) => [r, r + 2, r + 1, r + 1, r, r],
  m7: (r) => [r, r + 2, r, r, r, r],
  sus4: (r) => [r, r + 2, r + 2, r + 2, r, r],
  sus2: (r) => [r, r + 2, r + 4, r + 4, r, r],
};
const A_SHAPE: Record<ShapeKey, (r: number) => number[]> = {
  maj: (r) => [-1, r, r + 2, r + 2, r + 2, r],
  min: (r) => [-1, r, r + 2, r + 2, r + 1, r],
  "7": (r) => [-1, r, r + 2, r, r + 2, r],
  maj7: (r) => [-1, r, r + 2, r + 1, r + 2, r],
  m7: (r) => [-1, r, r + 2, r, r + 1, r],
  sus4: (r) => [-1, r, r + 2, r + 2, r + 3, r],
  sus2: (r) => [-1, r, r + 2, r + 2, r, r],
};

function suffixToShape(suffix: string): ShapeKey | null {
  const s = suffix.trim();
  if (s === "") return "maj";
  if (s === "m" || s === "min") return "min";
  if (s === "7") return "7";
  if (s === "maj7") return "maj7";
  if (s === "m7") return "m7";
  if (s === "sus4" || s === "sus") return "sus4";
  if (s === "sus2") return "sus2";
  if (s === "add9") return "maj"; // approximate with the major shape
  if (s === "9" || s === "13") return "7";
  return null; // dim, aug, and anything we won't draw
}

function baseFretOf(frets: number[]): number {
  const pos = frets.filter((f) => f > 0);
  if (pos.length === 0) return 1;
  return Math.max(...pos) <= 4 ? 1 : Math.min(...pos);
}

/** Movable voicing for a pitch class + shape (picks the lower of E/A shapes). */
export function getChordShape(rootPC: number, shape: ShapeKey): Voicing | null {
  if (rootPC < 0) return null;
  const eFret = (((rootPC - 4) % 12) + 12) % 12;
  const aFret = (((rootPC - 9) % 12) + 12) % 12;
  const frets = aFret <= eFret ? A_SHAPE[shape](aFret) : E_SHAPE[shape](eFret);
  return { frets, baseFret: baseFretOf(frets) };
}

/** Voicing for a letter chord ("C", "F#m", "Bb", "D/F#"). Bass is ignored. */
export function getChordShapeForLetters(label: string): Voicing | null {
  const raw = (label ?? "").trim();
  if (!raw) return null;
  const main = raw.split("/")[0].trim();
  const m = main.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return null;
  const rootPC = pitchClass(m[1]);
  if (rootPC < 0) return null;

  if (OPEN[main]) return { frets: OPEN[main], baseFret: baseFretOf(OPEN[main]) };

  const shape = suffixToShape(m[2]);
  if (!shape) return null;
  return getChordShape(rootPC, shape);
}
