import { describe, expect, it } from "vitest";
import { detectSpokenCues } from "@/lib/capture/spokenCues";
import type { TranscriptWord } from "@/lib/capture/transcriptModel";

/**
 * F12 Step 7 — the broader say-it-structured vocabulary: spoken scripture
 * references and note-to-self cues. Precision-first: a wrong chip is worse
 * than a missed one.
 */

function flowing(spoken: string, startMs = 0, gapMs = 80): TranscriptWord[] {
  let t = startMs;
  return spoken.split(/\s+/).map((text) => {
    const w = { text, startMs: t, endMs: t + 220 };
    t += 220 + gapMs;
    return w;
  });
}

function after(words: TranscriptWord[], pauseMs: number, spoken: string, gapMs = 80): TranscriptWord[] {
  const last = words[words.length - 1];
  return [...words, ...flowing(spoken, (last?.endMs ?? 0) + pauseMs, gapMs)];
}

describe("spokenCues — scripture references", () => {
  it("hears 'Psalm twenty three'", () => {
    const { scriptures } = detectSpokenCues(flowing("this is from psalm twenty three the shepherd song"));
    expect(scriptures).toHaveLength(1);
    expect(scriptures[0].reference).toBe("Psalm 23");
  });

  it("hears 'John three sixteen' (ambiguous book + chapter AND verse)", () => {
    const { scriptures } = detectSpokenCues(flowing("like john three sixteen says"));
    expect(scriptures).toHaveLength(1);
    expect(scriptures[0].reference).toBe("John 3:16");
  });

  it("hears 'first Corinthians thirteen'", () => {
    const { scriptures } = detectSpokenCues(flowing("build the bridge on first corinthians thirteen"));
    expect(scriptures).toHaveLength(1);
    expect(scriptures[0].reference).toBe("1 Corinthians 13");
  });

  it("hears 'Acts chapter two' (the word 'chapter' is strong evidence)", () => {
    const { scriptures } = detectSpokenCues(flowing("something from acts chapter two"));
    expect(scriptures).toHaveLength(1);
    expect(scriptures[0].reference).toBe("Acts 2");
  });

  it("hears a fused '3:16' token", () => {
    const { scriptures } = detectSpokenCues(flowing("john 3:16 forever"));
    expect(scriptures).toHaveLength(1);
    expect(scriptures[0].reference).toBe("John 3:16");
  });

  it("never fires on ambiguous words without evidence", () => {
    for (const line of [
      "i will mark this moment forever",
      "hey jude do not be afraid",
      "his acts of love surround me",
      "job 3", // ambiguous book + bare chapter = not enough
      "every good and perfect gift from james",
    ]) {
      const { scriptures } = detectSpokenCues(flowing(line));
      expect(scriptures, line).toHaveLength(0);
    }
  });

  it("unambiguous books accept a bare chapter ('Revelation 22')", () => {
    const { scriptures } = detectSpokenCues(flowing("straight out of revelation 22"));
    expect(scriptures).toHaveLength(1);
    expect(scriptures[0].reference).toBe("Revelation 22");
  });
});

describe("spokenCues — notes to self", () => {
  it("captures 'note — remember the key change' after a breath", () => {
    let w = flowing("chorus lifted high");
    w = after(w, 600, "note remember the key change");
    const { notes } = detectSpokenCues(w);
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe("remember the key change");
  });

  it("'make a note that…' triggers at the start of a take", () => {
    const { notes } = detectSpokenCues(flowing("make a note that the bridge lifts a third"));
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe("the bridge lifts a third");
  });

  it("'a love note for you' sung mid-phrase never triggers", () => {
    const { notes } = detectSpokenCues(flowing("i wrote a love note for you"));
    expect(notes).toHaveLength(0);
  });

  it("the note body ends at a long breath", () => {
    let w = flowing("note check the second line", 0);
    w = after(w, 1400, "totally unrelated lyric");
    const { notes } = detectSpokenCues(w);
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe("check the second line");
  });
});
