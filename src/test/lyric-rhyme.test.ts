import { describe, it, expect } from "vitest";
import {
  rhymeKey,
  classifyRhyme,
  rhymeScheme,
  lastWord,
} from "@/lib/lyrics/rhyme";

describe("rhymeKey — the rhyming tail", () => {
  it("matches perfect rhymes on the tail", () => {
    expect(rhymeKey("grace")).toBe(rhymeKey("place"));
    expect(rhymeKey("light")).toBe(rhymeKey("night"));
    expect(rhymeKey("love")).toBe(rhymeKey("dove"));
    expect(rhymeKey("sound")).toBe(rhymeKey("ground"));
  });

  it("collapses doubled vowels so short long-vowel words rhyme", () => {
    expect(rhymeKey("me")).toBe(rhymeKey("see"));
    expect(rhymeKey("free")).toBe(rhymeKey("tree"));
  });

  it("does not collide unrelated endings", () => {
    expect(rhymeKey("grace")).not.toBe(rhymeKey("light"));
  });

  it("is empty-safe", () => {
    expect(rhymeKey("")).toBe("");
    expect(rhymeKey("!!")).toBe("");
  });
});

describe("classifyRhyme — perfect / slant / assonance / none", () => {
  it("detects perfect rhymes", () => {
    expect(classifyRhyme("grace", "place")).toBe("perfect");
    expect(classifyRhyme("night", "light")).toBe("perfect");
  });

  it("detects slant rhymes (shared ending consonants, different vowel)", () => {
    expect(classifyRhyme("heart", "start")).toBe("slant");
  });

  it("detects assonance (shared vowel, different coda)", () => {
    expect(classifyRhyme("cat", "cab")).toBe("assonance");
  });

  it("treats a word against itself as not a rhyme (identity)", () => {
    expect(classifyRhyme("grace", "grace")).toBe("none");
    expect(classifyRhyme("Grace", "grace")).toBe("none");
  });

  it("returns none for unrelated words", () => {
    expect(classifyRhyme("grace", "mountain")).toBe("none");
  });
});

describe("lastWord — the rhyme-bearing word of a line", () => {
  it("ignores chords and trailing punctuation", () => {
    expect(lastWord("[G]Amazing [C]grace,")).toBe("grace");
    expect(lastWord("through the night!")).toBe("night");
  });

  it("is empty-safe", () => {
    expect(lastWord("")).toBe("");
    expect(lastWord("   ")).toBe("");
  });
});

describe("rhymeScheme — label lines A/B/C by their ending rhyme", () => {
  it("labels an ABAB block", () => {
    const scheme = rhymeScheme([
      "Amazing grace",
      "the morning light",
      "a quiet place",
      "through the night",
    ]);
    expect(scheme).toEqual(["A", "B", "A", "B"]);
  });

  it("labels an AABB block", () => {
    const scheme = rhymeScheme([
      "Amazing grace",
      "a quiet place",
      "the morning light",
      "through the night",
    ]);
    expect(scheme).toEqual(["A", "A", "B", "B"]);
  });

  it("marks blank lines and unique endings", () => {
    expect(rhymeScheme(["grace", "", "place"])).toEqual(["A", "-", "A"]);
    expect(rhymeScheme(["grace", "mountain"])).toEqual(["A", "B"]);
  });
});
