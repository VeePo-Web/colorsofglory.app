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

describe("sectionKeywords — mishear robustness", () => {
  it("routes the classic 'course' mishear of chorus", () => {
    const w = words("course you are my rock");
    const m = detectSectionMarkers(w)[0];
    expect(m?.kind).toBe("chorus");
    const block = buildTranscriptBlocks(w, [m]).find((b) => b.marker.kind === "chorus");
    expect(block!.text.toLowerCase()).not.toContain("course");
    expect(block!.text.toLowerCase()).toContain("you are my rock");
  });

  it("handles 'pre course' as pre-chorus", () => {
    const m = detectSectionMarkers(words("pre course lift it up"))[0];
    expect(m?.kind).toBe("pre-chorus");
  });

  it("does NOT trigger on 'of course' (ordinary speech, not a section)", () => {
    const markers = detectSectionMarkers(words("of course you are faithful and good"));
    expect(markers).toEqual([]);
  });
});

describe("sectionKeywords — plural tolerance", () => {
  const plurals: Array<[string, string]> = [
    ["verses", "verse"],
    ["choruses", "chorus"],
    ["bridges", "bridge"],
    ["intros", "intro"],
    ["outros", "outro"],
    ["hooks", "hook"],
    ["interludes", "interlude"],
    ["refrains", "chorus"],
    ["endings", "outro"],
  ];
  for (const [spoken, kind] of plurals) {
    it(`'${spoken}' → ${kind}`, () => {
      const m = detectSectionMarkers(words(`${spoken} carry the melody`))[0];
      expect(m?.kind).toBe(kind);
    });
  }
});

describe("sectionKeywords — mishears still split a full memo", () => {
  it("'course' and pluralised calls split alongside clean ones", () => {
    const w = words("verse one morning light course you are my rock bridges nothing else");
    const labels = detectSectionMarkers(w).map((m) => m.label);
    expect(labels).toEqual(["Verse 1", "Chorus", "Bridge"]);
  });
});
