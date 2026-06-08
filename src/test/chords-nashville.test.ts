import { describe, it, expect } from "vitest";
import {
  diatonic,
  chordToLetters,
  chordToNumbers,
  progressionToLetters,
  transpose,
  type Progression,
  type NumberChord,
} from "@/lib/chords/nashville";
import { MAJOR_KEYS, MINOR_KEYS } from "@/lib/chords/keys";

describe("Nashville engine — diatonic", () => {
  it("renders G major diatonic as G Am Bm C D Em F#°", () => {
    const letters = diatonic("major").map((c) => chordToLetters(c, "G"));
    expect(letters).toEqual(["G", "Am", "Bm", "C", "D", "Em", "F#°"]);
  });

  it("renders C major diatonic as C Dm Em F G Am B°", () => {
    const letters = diatonic("major").map((c) => chordToLetters(c, "C"));
    expect(letters).toEqual(["C", "Dm", "Em", "F", "G", "Am", "B°"]);
  });

  it("uses flat spelling in flat keys (F major: 7° = E°)", () => {
    const letters = diatonic("major").map((c) => chordToLetters(c, "F"));
    expect(letters).toEqual(["F", "Gm", "Am", "Bb", "C", "Dm", "E°"]);
  });

  it("renders A minor diatonic as Am B° C Dm Em F G", () => {
    const letters = diatonic("minor").map((c) => chordToLetters(c, "A", "minor"));
    expect(letters).toEqual(["Am", "B°", "C", "Dm", "Em", "F", "G"]);
  });
});

describe("Nashville engine — number rendering", () => {
  it("hides diatonic quality (1 not 1maj, 6m for the vi)", () => {
    expect(chordToNumbers({ degree: 1, quality: "maj" })).toBe("1");
    expect(chordToNumbers({ degree: 6, quality: "min" })).toBe("6m");
    expect(chordToNumbers({ degree: 7, quality: "dim" })).toBe("7°");
  });

  it("shows quality when it overrides the diatonic default", () => {
    expect(chordToNumbers({ degree: 4, quality: "min" })).toBe("4m"); // minor four
    expect(chordToNumbers({ degree: 1, quality: "sus4" })).toBe("1sus4");
  });

  it("renders accidentals (b7, b3)", () => {
    expect(chordToNumbers({ degree: 7, accidental: "b", quality: "maj" })).toBe("b7");
    expect(chordToNumbers({ degree: 3, accidental: "b", quality: "maj" })).toBe("b3");
  });

  it("renders slash chords", () => {
    expect(
      chordToNumbers({ degree: 1, quality: "maj", bass: { degree: 3 } }),
    ).toBe("1/3");
  });
});

describe("Nashville engine — borrowed chords resolve correctly", () => {
  it("b7 in G major = F; in A major = G", () => {
    const c: NumberChord = { degree: 7, accidental: "b", quality: "maj" };
    expect(chordToLetters(c, "G")).toBe("F");
    expect(chordToLetters(c, "A")).toBe("G");
  });

  it("4m (minor four) in C = Fm; in G = Cm", () => {
    const c: NumberChord = { degree: 4, quality: "min" };
    expect(chordToLetters(c, "C")).toBe("Fm");
    expect(chordToLetters(c, "G")).toBe("Cm");
  });
});

describe("Nashville engine — transpose is lossless across all keys", () => {
  const progression: Progression = {
    key: "C",
    mode: "major",
    chords: [
      { degree: 1, quality: "maj" },
      { degree: 5, quality: "maj" },
      { degree: 6, quality: "min" },
      { degree: 4, quality: "maj" },
    ],
  };

  it("transposes G→A→G without drift", () => {
    const inG = progressionToLetters(progression, "G");
    expect(inG).toBe("G D Em C");
    const inA = progressionToLetters(progression, "A");
    expect(inA).toBe("A E F#m D");
    // Back to G via transpose helper
    const round = transpose(transpose(progression, "A"), "G");
    expect(progressionToLetters(round)).toBe("G D Em C");
  });

  it("renders a 1-5-6m-4 in every major key without throwing", () => {
    for (const k of MAJOR_KEYS) {
      expect(() => progressionToLetters(progression, k)).not.toThrow();
    }
  });

  it("renders a 1-b7-4-5 in every minor key without throwing", () => {
    const minorProg: Progression = {
      key: "Am",
      mode: "minor",
      chords: [
        { degree: 1, quality: "min" },
        { degree: 7, quality: "maj" },
        { degree: 4, quality: "min" },
        { degree: 5, quality: "min" },
      ],
    };
    for (const k of MINOR_KEYS) {
      const tonic = k.replace(/m$/, "");
      expect(() => progressionToLetters(minorProg, tonic, "minor")).not.toThrow();
    }
  });
});

describe("Nashville engine — enharmonic preference", () => {
  it("F major prefers flats (Bb, not A#)", () => {
    expect(chordToLetters({ degree: 4, quality: "maj" }, "F")).toBe("Bb");
  });

  it("F# major prefers sharps", () => {
    expect(chordToLetters({ degree: 1, quality: "maj" }, "F#")).toBe("F#");
    expect(chordToLetters({ degree: 4, quality: "maj" }, "F#")).toBe("B");
  });

  it("Db major prefers flats", () => {
    expect(chordToLetters({ degree: 4, quality: "maj" }, "Db")).toBe("Gb");
  });
});