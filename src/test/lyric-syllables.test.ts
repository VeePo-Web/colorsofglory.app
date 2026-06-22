import { describe, it, expect } from "vitest";
import {
  countSyllables,
  countLineSyllables,
  syllableBreakdown,
  lineSyllableProfile,
} from "@/lib/lyrics/syllables";

describe("countSyllables — single words", () => {
  it("counts simple one-syllable words", () => {
    expect(countSyllables("grace")).toBe(1);
    expect(countSyllables("world")).toBe(1);
    expect(countSyllables("love")).toBe(1); // silent e
    expect(countSyllables("the")).toBe(1);
  });

  it("counts multi-syllable words", () => {
    expect(countSyllables("amazing")).toBe(3);
    expect(countSyllables("glory")).toBe(2);
    expect(countSyllables("heaven")).toBe(2);
    expect(countSyllables("Jesus")).toBe(2);
    expect(countSyllables("beautiful")).toBe(3);
    expect(countSyllables("hallelujah")).toBe(4);
  });

  it("handles the silent-e and -le endings", () => {
    expect(countSyllables("table")).toBe(2); // -le keeps its syllable
    expect(countSyllables("fire")).toBe(1);  // silent e
    expect(countSyllables("come")).toBe(1);
  });

  it("handles apostrophes and casing", () => {
    expect(countSyllables("I'm")).toBe(1);
    expect(countSyllables("GRACE")).toBe(1);
    expect(countSyllables("heaven's")).toBe(2);
  });

  it("is empty-safe and floors at one for real words", () => {
    expect(countSyllables("")).toBe(0);
    expect(countSyllables("!?,.")).toBe(0);
    expect(countSyllables("sky")).toBe(1); // y as the only vowel
  });
});

describe("countLineSyllables — whole lines", () => {
  it("sums words and ignores punctuation", () => {
    expect(countLineSyllables("Amazing grace how sweet the sound")).toBe(8);
    expect(countLineSyllables("Lord, I wait for You")).toBe(5);
  });

  it("ignores inline ChordPro chord tokens", () => {
    expect(countLineSyllables("[G]Amazing [G7]grace")).toBe(4);
  });

  it("is empty-safe", () => {
    expect(countLineSyllables("")).toBe(0);
    expect(countLineSyllables("   ")).toBe(0);
  });
});

describe("syllableBreakdown — per word, for UI highlighting", () => {
  it("returns each word with its count", () => {
    expect(syllableBreakdown("Amazing grace")).toEqual([
      { word: "Amazing", count: 3 },
      { word: "grace", count: 1 },
    ]);
  });
});

describe("lineSyllableProfile — prosody helper (Pattison: parallel lines should match)", () => {
  it("counts per line across a block of text", () => {
    const profile = lineSyllableProfile("Amazing grace how sweet the sound\nThat saved a wretch like me");
    expect(profile).toEqual([8, 6]);
  });

  it("skips blank lines", () => {
    const profile = lineSyllableProfile("grace\n\nlove");
    expect(profile).toEqual([1, 1]);
  });
});
