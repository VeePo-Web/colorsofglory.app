import { describe, expect, it } from "vitest";
import {
  buildTranscriptBlocks,
  detectSectionMarkers,
  isAppliedMarker,
} from "@/lib/capture/sectionKeywords";
import type { TranscriptWord } from "@/lib/capture/transcriptModel";

/**
 * F12 Step 2 — expanded worship/songwriting vocabulary. Every phrase is spoken
 * as a real announcement (after a breath), the way a writer actually calls a
 * section — and the announcement words never leak into the body.
 */

function flowing(spoken: string, startMs = 0): TranscriptWord[] {
  let t = startMs;
  return spoken.split(/\s+/).map((text) => {
    const w = { text, startMs: t, endMs: t + 220 };
    t += 300;
    return w;
  });
}

function after(words: TranscriptWord[], pauseMs: number, spoken: string): TranscriptWord[] {
  const last = words[words.length - 1];
  return [...words, ...flowing(spoken, (last?.endMs ?? 0) + pauseMs)];
}

describe("sectionVocabulary — expanded section calls", () => {
  it("'last chorus' / 'final chorus' → Final Chorus", () => {
    for (const phrase of ["last chorus", "final chorus"]) {
      let w = flowing("bridge lifted");
      w = after(w, 700, phrase);
      w = after(w, 350, "sing it one more time");
      const applied = detectSectionMarkers(w).filter(isAppliedMarker);
      const final = applied.find((m) => m.label === "Final Chorus");
      expect(final, phrase).toBeDefined();
      expect(final!.kind).toBe("chorus");
    }
  });

  it("'the drop' → a chorus-kind Drop section", () => {
    let w = flowing("quiet now");
    w = after(w, 700, "the drop");
    w = after(w, 350, "everything falls away");
    const blocks = buildTranscriptBlocks(w, detectSectionMarkers(w));
    const drop = blocks.find((b) => b.marker.label === "Drop");
    expect(drop).toBeDefined();
    expect(drop!.marker.kind).toBe("chorus");
    expect(drop!.text.toLowerCase()).toBe("everything falls away");
  });

  it("'instrumental' → an Instrumental interlude", () => {
    let w = flowing("verse one morning light");
    w = after(w, 700, "instrumental");
    w = after(w, 350, "just the guitar here");
    const blocks = buildTranscriptBlocks(w, detectSectionMarkers(w));
    const inst = blocks.find((b) => b.marker.label === "Instrumental");
    expect(inst).toBeDefined();
    expect(inst!.marker.kind).toBe("interlude");
  });

  it("'second time' repeats the previous section as its second pass", () => {
    let w = flowing("chorus lifted high");
    w = after(w, 700, "second time");
    w = after(w, 350, "lifted higher still");
    const blocks = buildTranscriptBlocks(w, detectSectionMarkers(w));
    expect(blocks.map((b) => b.marker.label)).toEqual(["Chorus", "Chorus 2"]);
    // The repeat call itself never enters the lyric body.
    expect(blocks[1].text.toLowerCase()).toBe("lifted higher still");
  });

  it("'second time' cold (no prior section) never triggers", () => {
    const w = flowing("second time around love found me");
    expect(detectSectionMarkers(w)).toHaveLength(0);
  });

  it("'chorus second time' absorbs the repeat words into the marker", () => {
    let w = flowing("verse one morning light");
    w = after(w, 700, "chorus second time");
    w = after(w, 350, "again we sing");
    const blocks = buildTranscriptBlocks(w, detectSectionMarkers(w));
    const chorus2 = blocks.find((b) => b.marker.kind === "chorus");
    expect(chorus2).toBeDefined();
    expect(chorus2!.marker.ordinal).toBe(2);
    expect(chorus2!.text.toLowerCase()).toBe("again we sing");
  });

  it("higher spoken ordinals ('verse six') parse", () => {
    const w = after(flowing("outro fading"), 700, "verse six hallelujah");
    const verse = detectSectionMarkers(w).find((m) => m.kind === "verse");
    expect(verse).toBeDefined();
    expect(verse!.ordinal).toBe(6);
    expect(verse!.label).toBe("Verse 6");
  });

  it("'channel' routes to pre-chorus (worship vocabulary)", () => {
    const w = after(flowing("verse one steady"), 700, "channel building now");
    const m = detectSectionMarkers(w).find((x) => x.kind === "pre-chorus");
    expect(m).toBeDefined();
  });

  it("ordinary lyric words never over-trigger ('never let me drop')", () => {
    const w = flowing("you never let me drop into the deep");
    const applied = detectSectionMarkers(w).filter(isAppliedMarker);
    expect(applied).toHaveLength(0);
  });
});
