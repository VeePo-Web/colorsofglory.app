import { describe, expect, it } from "vitest";
import {
  buildTranscriptBlocks,
  detectSectionMarkers,
} from "@/lib/capture/sectionKeywords";
import type { TranscriptWord } from "@/lib/capture/transcriptModel";

/** Helper: 1 word per second starting at 0. */
function words(spoken: string): TranscriptWord[] {
  return spoken.split(/\s+/).map((text, i) => ({
    text,
    startMs: i * 1000,
    endMs: i * 1000 + 800,
  }));
}

describe("sectionKeywords — fuzzy + strip", () => {
  it("strips a bare marker word from the following block", () => {
    const w = words("hi there chorus you are my rock");
    const markers = detectSectionMarkers(w);
    const blocks = buildTranscriptBlocks(w, markers);
    const chorus = blocks.find((b) => b.marker.kind === "chorus");
    expect(chorus).toBeDefined();
    expect(chorus!.text.toLowerCase()).not.toContain("chorus");
    expect(chorus!.text.toLowerCase()).toContain("you are my rock");
  });

  it("absorbs leading fillers like 'okay' and 'the' into the marker", () => {
    const w = words("hello okay the chorus you are my rock");
    const markers = detectSectionMarkers(w);
    const blocks = buildTranscriptBlocks(w, markers);
    const chorus = blocks.find((b) => b.marker.kind === "chorus");
    expect(chorus).toBeDefined();
    // None of the announcement leaks into the body.
    expect(chorus!.text.toLowerCase()).not.toMatch(/(okay|the|chorus)/);
    // And the *first* block (Idea) ends before "okay".
    expect(blocks[0].text.toLowerCase()).not.toContain("okay");
    expect(blocks[0].text.toLowerCase()).toContain("hello");
  });

  it("captures 'verse two' as ordinal 2 and strips both words", () => {
    const w = words("verse two and i will lift my voice");
    const markers = detectSectionMarkers(w);
    expect(markers[0].kind).toBe("verse");
    expect(markers[0].ordinal).toBe(2);
    const blocks = buildTranscriptBlocks(w, markers);
    const verse = blocks.find((b) => b.marker.kind === "verse");
    expect(verse!.text.toLowerCase()).not.toMatch(/(verse|two)/);
    expect(verse!.text.toLowerCase()).toContain("i will lift my voice");
  });

  it("handles 'this is the bridge' announcement", () => {
    const w = words("alright this is the bridge you are holy");
    const markers = detectSectionMarkers(w);
    const blocks = buildTranscriptBlocks(w, markers);
    const bridge = blocks.find((b) => b.marker.kind === "bridge");
    expect(bridge).toBeDefined();
    expect(bridge!.text.toLowerCase()).not.toMatch(/(this|is|the|bridge|alright)/);
    expect(bridge!.text.toLowerCase()).toContain("you are holy");
  });
});