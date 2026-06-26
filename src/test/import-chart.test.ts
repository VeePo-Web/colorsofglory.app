import { describe, it, expect } from "vitest";
import {
  looksLikeChordPro,
  looksLikeChordsOverLyrics,
  chordsOverLyricsToChordPro,
} from "@/lib/chords/importChart";
import { parseChordProLine } from "@/lib/chords/sheet";

describe("format detection", () => {
  it("detects ChordPro by inline brackets", () => {
    expect(looksLikeChordPro("[C]Hello [G]world")).toBe(true);
    expect(looksLikeChordPro("Amazing [C]grace")).toBe(true);
  });

  it("does not call a whole-line [Verse] header ChordPro", () => {
    expect(looksLikeChordPro("[Verse 1]\nC G\nHello there")).toBe(false);
  });

  it("plain text is neither", () => {
    expect(looksLikeChordPro("just some words")).toBe(false);
    expect(looksLikeChordsOverLyrics("just some words\nmore words")).toBe(false);
  });

  it("detects a chords-over-lyrics chart", () => {
    expect(looksLikeChordsOverLyrics("C   G\nHello world")).toBe(true);
    expect(looksLikeChordsOverLyrics("[Verse 1]\nC      G\nAmazing grace")).toBe(true);
  });

  it("ChordPro is not flagged as chords-over-lyrics", () => {
    expect(looksLikeChordsOverLyrics("[C]Hello [G]world")).toBe(false);
  });
});

describe("chordsOverLyricsToChordPro — column-accurate conversion", () => {
  it("places chords at their column over the lyric", () => {
    expect(chordsOverLyricsToChordPro("C   G\nHello world")).toBe("[C]Hell[G]o world");
  });

  it("converts section headers (brackets, colon, keyword+number)", () => {
    expect(chordsOverLyricsToChordPro("[Verse 1]\nC\nHello")).toBe("{start_of_section: Verse 1}\n[C]Hello");
    expect(chordsOverLyricsToChordPro("Chorus:\nG\nWorld")).toBe("{start_of_section: Chorus}\n[G]World");
    expect(chordsOverLyricsToChordPro("Verse 2\nD\nMore")).toBe("{start_of_section: Verse 2}\n[D]More");
  });

  it("keeps an instrumental chord line as chord-only", () => {
    expect(chordsOverLyricsToChordPro("C G Am\n\nnext line")).toBe("[C] [G] [Am]\n\nnext line");
  });

  it("passes plain lyric lines through untouched", () => {
    expect(chordsOverLyricsToChordPro("no chords here\nstill none")).toBe("no chords here\nstill none");
  });

  it("round-trips: converted lines parse back to the right text + anchors", () => {
    const cp = chordsOverLyricsToChordPro("G       C\nAmazing grace");
    const line = parseChordProLine(cp, "C");
    expect(line.text).toBe("Amazing grace");
    expect(line.anchors.map((a) => a.at)).toEqual([0, 8]); // G over 'Amazing', C over 'grace'
  });
});
