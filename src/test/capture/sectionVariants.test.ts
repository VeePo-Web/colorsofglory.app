import { describe, expect, it } from "vitest";
import {
  buildTranscriptBlocks,
  detectSectionMarkers,
} from "@/lib/capture/sectionKeywords";
import type { TranscriptWord } from "@/lib/capture/transcriptModel";

/** 1 word per second from 0. */
function words(spoken: string): TranscriptWord[] {
  return spoken.split(/\s+/).map((text, i) => ({
    text,
    startMs: i * 1000,
    endMs: i * 1000 + 800,
  }));
}

describe("sectionKeywords — letter variants", () => {
  it("parses a fused 'verse 1a' into ordinal 1 + variant A", () => {
    const w = words("verse 1a hold me now");
    const m = detectSectionMarkers(w)[0];
    expect(m).toMatchObject({ kind: "verse", ordinal: 1, variant: "A", label: "Verse 1A" });
    const verse = buildTranscriptBlocks(w, [m]).find((b) => b.marker.kind === "verse");
    // The announcement (verse + 1a) is stripped from the body.
    expect(verse!.text.toLowerCase()).not.toMatch(/(verse|1a)/);
    expect(verse!.text.toLowerCase()).toContain("hold me now");
  });

  it("parses a spaced 'verse 1 b' into ordinal 1 + variant B", () => {
    const w = words("verse 1 b a different take");
    const m = detectSectionMarkers(w)[0];
    expect(m).toMatchObject({ ordinal: 1, variant: "B", label: "Verse 1B" });
    const verse = buildTranscriptBlocks(w, [m]).find((b) => b.marker.kind === "verse");
    expect(verse!.text.toLowerCase()).toContain("a different take");
    expect(verse!.text.toLowerCase()).not.toMatch(/\bverse\b/);
  });

  it("does NOT treat a lone trailing 'a' as a variant (it's the article)", () => {
    const w = words("verse 1 a quiet morning");
    const m = detectSectionMarkers(w)[0];
    expect(m.ordinal).toBe(1);
    expect(m.variant).toBeUndefined();
    expect(m.label).toBe("Verse 1");
    const verse = buildTranscriptBlocks(w, [m]).find((b) => b.marker.kind === "verse");
    expect(verse!.text.toLowerCase()).toContain("a quiet morning");
  });
});

describe("sectionKeywords — ordinals on every section", () => {
  it("numbers a chorus ('chorus 2')", () => {
    const m = detectSectionMarkers(words("chorus 2 sing it again"))[0];
    expect(m).toMatchObject({ kind: "chorus", ordinal: 2, label: "Chorus 2" });
  });

  it("numbers a bridge ('bridge 2')", () => {
    const m = detectSectionMarkers(words("bridge 2 lift it higher"))[0];
    expect(m).toMatchObject({ kind: "bridge", ordinal: 2, label: "Bridge 2" });
  });

  it("a bare chorus stays unnumbered", () => {
    const m = detectSectionMarkers(words("chorus you are my rock"))[0];
    expect(m.kind).toBe("chorus");
    expect(m.ordinal).toBeUndefined();
    expect(m.label).toBe("Chorus");
  });

  it("'first verse' / 'second verse' keep their fixed ordinals", () => {
    const labels = detectSectionMarkers(
      words("first verse here we are second verse and again"),
    ).map((m) => m.label);
    expect(labels).toEqual(["Verse 1", "Verse 2"]);
  });
});

describe("sectionKeywords — synonyms route to intent", () => {
  const cases: Array<[string, string]> = [
    ["ending", "outro"],
    ["coda", "outro"],
    ["refrain", "chorus"],
    ["vamp", "tag"],
    ["turnaround", "bridge"],
    ["breakdown", "interlude"],
  ];
  for (const [word, kind] of cases) {
    it(`'${word}' → ${kind}`, () => {
      const m = detectSectionMarkers(words(`${word} carry the song`))[0];
      expect(m.kind).toBe(kind);
      const block = buildTranscriptBlocks(words(`${word} carry the song`), [m]).find(
        (b) => b.marker.kind === kind,
      );
      expect(block!.text.toLowerCase()).not.toContain(word);
      expect(block!.text.toLowerCase()).toContain("carry the song");
    });
  }
});

describe("sectionKeywords — full one-memo split", () => {
  it("groups everything under each keyword until the next one (the golden moment)", () => {
    const w = words(
      "verse one morning light breaks chorus you are my rock bridge 2 nothing else ending fade away",
    );
    const markers = detectSectionMarkers(w);
    const blocks = buildTranscriptBlocks(w, markers);
    expect(blocks.map((b) => b.marker.label)).toEqual([
      "Verse 1",
      "Chorus",
      "Bridge 2",
      "Outro",
    ]);
    const chorus = blocks.find((b) => b.marker.label === "Chorus");
    expect(chorus!.text.toLowerCase()).toContain("you are my rock");
    expect(chorus!.text.toLowerCase()).not.toContain("bridge");
  });
});
