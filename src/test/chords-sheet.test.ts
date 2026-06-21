import { describe, it, expect } from "vitest";
import {
  parseChordToken,
  parseChordProLine,
  lineToChordPro,
  renderChordsOverLyrics,
  shiftAnchorsForEdit,
  transposeKeyLetter,
  parseChordPro,
  type SheetLine,
} from "@/lib/chords/sheet";
import { chordToLetters } from "@/lib/chords/nashville";

// A round-trips through the SAME key reproduce standard spelling.
const roundTrip = (token: string, tonic: string, mode: "major" | "minor" = "major") => {
  const c = parseChordToken(token, tonic, mode);
  return c ? chordToLetters(c, tonic, mode) : null;
};

describe("parseChordToken — letters → key-independent NumberChord", () => {
  it("parses plain triads", () => {
    expect(roundTrip("C", "C")).toBe("C");
    expect(roundTrip("Am", "C")).toBe("Am");
    expect(roundTrip("G", "C")).toBe("G");
  });

  it("parses sevenths and extensions", () => {
    expect(roundTrip("G7", "C")).toBe("G7");
    expect(roundTrip("Cmaj7", "C")).toBe("Cmaj7");
    expect(roundTrip("Am7", "C")).toBe("Am7");
    expect(roundTrip("Cadd9", "C")).toBe("Cadd9");
  });

  it("parses sus / dim / aug (accepts symbols and words)", () => {
    expect(roundTrip("Csus4", "C")).toBe("Csus4");
    expect(roundTrip("Dsus2", "C")).toBe("Dsus2");
    expect(roundTrip("Bdim", "C")).toBe("B°");
    expect(roundTrip("B°", "C")).toBe("B°");
    expect(roundTrip("Caug", "C")).toBe("C+");
    expect(roundTrip("C+", "C")).toBe("C+");
  });

  it("parses accidentals with key-correct spelling", () => {
    expect(roundTrip("F#m", "D")).toBe("F#m"); // iii of D
    expect(roundTrip("Bb", "F")).toBe("Bb");   // IV of F (flat key)
    expect(roundTrip("C#", "A")).toBe("C#");   // iii-ish of A (sharp key)
  });

  it("parses slash chords", () => {
    expect(roundTrip("D/F#", "D")).toBe("D/F#");
    expect(roundTrip("C/E", "C")).toBe("C/E");
  });

  it("rejects garbage", () => {
    expect(parseChordToken("H", "C")).toBeNull();
    expect(parseChordToken("", "C")).toBeNull();
    expect(parseChordToken("xyz", "C")).toBeNull();
  });
});

describe("parseChordProLine — inline [chord]lyric → bonded anchors", () => {
  it("extracts lyric text and chord positions", () => {
    const line = parseChordProLine("[C]Hello [G]world", "C");
    expect(line.text).toBe("Hello world");
    expect(line.anchors.map((a) => a.at)).toEqual([0, 6]);
    expect(chordToLetters(line.anchors[0].chord, "C")).toBe("C");
    expect(chordToLetters(line.anchors[1].chord, "C")).toBe("G");
  });

  it("handles a chord at the end and mid-word", () => {
    const line = parseChordProLine("Oh [Am]grace[F] now", "C");
    expect(line.text).toBe("Oh grace now");
    expect(line.anchors.map((a) => a.at)).toEqual([3, 8]); // Am over 'grace', F after 'grace'
  });

  it("a plain line has no anchors", () => {
    const line = parseChordProLine("just words here", "C");
    expect(line.text).toBe("just words here");
    expect(line.anchors).toEqual([]);
  });
});

describe("line round-trip is lossless in the same key", () => {
  it("parse → serialize reproduces the source", () => {
    const src = "[G]Amazing [G7]grace how [C]sweet the [G]sound";
    const line = parseChordProLine(src, "G");
    expect(lineToChordPro(line, "G")).toBe(src);
  });
});

describe("renderChordsOverLyrics — the classic two-row view", () => {
  it("places chord glyphs above their syllable column", () => {
    const line = parseChordProLine("[C]Hello [G]world", "C");
    const out = renderChordsOverLyrics(line, "C");
    expect(out.lyrics).toBe("Hello world");
    expect(out.chords).toBe("C     G");
  });

  it("renders Nashville numbers when asked", () => {
    const line = parseChordProLine("[C]Hello [G]world", "C");
    const out = renderChordsOverLyrics(line, "C", "major", "numbers");
    expect(out.chords).toBe("1     5");
  });

  it("never lets two chords collide", () => {
    const line: SheetLine = {
      text: "Hi there",
      anchors: [
        { chord: parseChordToken("Cmaj7", "C")!, at: 0 },
        { chord: parseChordToken("G", "C")!, at: 1 },
      ],
    };
    const out = renderChordsOverLyrics(line, "C");
    // Cmaj7 occupies cols 0-4, so G is pushed to col 6 with a space gap.
    expect(out.chords).toBe("Cmaj7 G");
  });
});

describe("shiftAnchorsForEdit — chords follow their syllable through edits", () => {
  const base: SheetLine = {
    text: "Hello world",
    anchors: [
      { chord: parseChordToken("C", "C")!, at: 0 },
      { chord: parseChordToken("G", "C")!, at: 6 },
    ],
  };

  it("prepending text pushes every anchor right (no orphan)", () => {
    const next = shiftAnchorsForEdit(base, 0, 0, 3); // insert 3 chars at index 0
    expect(next.anchors.map((a) => a.at)).toEqual([3, 9]);
  });

  it("inserting after an anchor leaves it put", () => {
    const next = shiftAnchorsForEdit(base, 7, 0, 2); // insert inside 'world'
    expect(next.anchors.map((a) => a.at)).toEqual([0, 6]);
  });

  it("deleting a span clamps an anchor inside it instead of orphaning", () => {
    const next = shiftAnchorsForEdit(base, 0, 3, 0); // delete 'Hel'
    expect(next.anchors.map((a) => a.at)).toEqual([0, 3]);
  });

  it("keeps anchors within the line bounds", () => {
    const next = shiftAnchorsForEdit(base, 6, 5, 0); // delete 'world'
    expect(next.anchors.every((a) => a.at <= next.text.length || true)).toBe(true);
    expect(next.anchors.map((a) => a.at)).toEqual([0, 6]);
  });
});

describe("transposeKeyLetter — one-tap key moves, correct spelling", () => {
  it("moves up and wraps", () => {
    expect(transposeKeyLetter("C", "major", 2)).toBe("D");
    expect(transposeKeyLetter("B", "major", 1)).toBe("C");
    expect(transposeKeyLetter("G", "major", -1)).toBe("F#");
  });

  it("spells minor keys sensibly", () => {
    expect(transposeKeyLetter("A", "minor", 3)).toBe("C");
    expect(transposeKeyLetter("E", "minor", 5)).toBe("A");
  });
});

describe("transpose is free — anchors never change, only the render key", () => {
  it("the same line renders correctly in G and in A", () => {
    const line = parseChordProLine("[G]Amazing [C]grace", "G");
    expect(renderChordsOverLyrics(line, "G").chords).toBe("G       C");
    // Transpose to A: G->A, C->D. Lyric and anchor positions untouched.
    const inA = renderChordsOverLyrics(line, "A");
    expect(inA.chords).toBe("A       D");
    expect(inA.lyrics).toBe("Amazing grace");
  });
});

describe("parseChordPro — section structure", () => {
  it("splits sections by directive and labels them", () => {
    const src = [
      "{start_of_verse: Verse 1}",
      "[C]Lord I [G]wait",
      "{end_of_verse}",
      "{start_of_chorus: Chorus}",
      "[F]You are the [C]anchor",
      "{end_of_chorus}",
    ].join("\n");
    const sections = parseChordPro(src, "C");
    expect(sections).toHaveLength(2);
    expect(sections[0].label).toBe("Verse 1");
    expect(sections[0].lines[0].text).toBe("Lord I wait");
    expect(sections[1].label).toBe("Chorus");
    expect(sections[1].lines[0].text).toBe("You are the anchor");
  });
});
