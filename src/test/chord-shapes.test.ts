import { describe, it, expect } from "vitest";
import { getChordShapeForLetters } from "@/lib/chords/chordShapes";

const frets = (label: string) => getChordShapeForLetters(label)?.frets ?? null;

describe("open-chord voicings (the nice ones)", () => {
  it("common majors", () => {
    expect(frets("C")).toEqual([-1, 3, 2, 0, 1, 0]);
    expect(frets("G")).toEqual([3, 2, 0, 0, 0, 3]);
    expect(frets("D")).toEqual([-1, -1, 0, 2, 3, 2]);
    expect(frets("A")).toEqual([-1, 0, 2, 2, 2, 0]);
    expect(frets("E")).toEqual([0, 2, 2, 1, 0, 0]);
  });

  it("common minors and sevenths", () => {
    expect(frets("Am")).toEqual([-1, 0, 2, 2, 1, 0]);
    expect(frets("Em")).toEqual([0, 2, 2, 0, 0, 0]);
    expect(frets("G7")).toEqual([3, 2, 0, 0, 0, 1]);
    expect(frets("Cmaj7")).toEqual([-1, 3, 2, 0, 0, 0]);
  });
});

describe("movable barre voicings (correct everywhere)", () => {
  it("F is the E-shape barre", () => {
    expect(frets("F")).toEqual([1, 3, 3, 2, 1, 1]);
  });
  it("F# major = E-shape at fret 2", () => {
    expect(frets("F#")).toEqual([2, 4, 4, 3, 2, 2]);
  });
  it("Bb major = A-shape barre at fret 1", () => {
    expect(frets("Bb")).toEqual([-1, 1, 3, 3, 3, 1]);
  });
  it("Bm = A-shape minor barre at fret 2", () => {
    expect(frets("Bm")).toEqual([-1, 2, 4, 4, 3, 2]);
  });
  it("Fm = E-shape minor barre at fret 1", () => {
    expect(frets("Fm")).toEqual([1, 3, 3, 1, 1, 1]);
  });
});

describe("graceful handling", () => {
  it("ignores a slash bass for the fingering", () => {
    expect(frets("D/F#")).toEqual(frets("D"));
  });
  it("returns null for shapes we don't diagram (dim/aug)", () => {
    expect(getChordShapeForLetters("Bdim")).toBeNull();
    expect(getChordShapeForLetters("Caug")).toBeNull();
  });
  it("returns null for junk", () => {
    expect(getChordShapeForLetters("")).toBeNull();
    expect(getChordShapeForLetters("xyz")).toBeNull();
  });
});

describe("baseFret window", () => {
  it("open/low chords start at the nut", () => {
    expect(getChordShapeForLetters("C")?.baseFret).toBe(1);
  });
  it("high barres start at their lowest fretted position", () => {
    // C# major: E-shape at fret 9 (or A-shape at 4). A-shape wins (lower).
    const v = getChordShapeForLetters("C#");
    expect(v?.baseFret).toBeGreaterThan(1);
  });
});
