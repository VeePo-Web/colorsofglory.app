import { describe, expect, it } from "vitest";
import {
  buildTranscriptBlocks,
  detectSectionMarkers,
} from "@/lib/capture/sectionKeywords";
import type { TranscriptWord } from "@/lib/capture/transcriptModel";

function w(text: string, startMs: number, endMs = startMs + 200): TranscriptWord {
  return { text, startMs, endMs };
}

describe("detectSectionMarkers", () => {
  it("returns no markers for empty input", () => {
    expect(detectSectionMarkers([])).toEqual([]);
  });

  it("detects a single chorus keyword", () => {
    const markers = detectSectionMarkers([w("Chorus", 1000), w("oh", 1500)]);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      kind: "chorus",
      source: "voice",
      atMs: 1000,
      label: "Chorus",
    });
  });

  it("parses verse with spoken ordinal", () => {
    const markers = detectSectionMarkers([
      w("Verse", 0),
      w("one", 200),
      w("when", 600),
    ]);
    expect(markers[0]).toMatchObject({ kind: "verse", ordinal: 1, label: "Verse 1" });
  });

  it("handles pre chorus as two tokens", () => {
    const markers = detectSectionMarkers([w("pre", 500), w("chorus", 700)]);
    expect(markers[0].kind).toBe("pre-chorus");
  });

  it("backfills verse ordinals when none were spoken", () => {
    const markers = detectSectionMarkers([
      w("Verse", 0),
      w("when", 200),
      w("Verse", 3000),
      w("again", 3200),
    ]);
    expect(markers.map((m) => m.label)).toEqual(["Verse 1", "Verse 2"]);
  });

  it("absorbs leading fillers ('okay this is the chorus') into the marker, never the body", () => {
    const stream = [
      w("okay", 1000),
      w("this", 1300),
      w("is", 1600),
      w("the", 1900),
      w("chorus", 2200),
      w("lifted", 3000),
      w("high", 3300),
    ];
    const markers = detectSectionMarkers(stream);
    expect(markers).toHaveLength(1);
    // The marker owns the whole spoken phrase, back through the fillers…
    expect(markers[0].atMs).toBe(1000);
    // …and the lyric body starts only after the trigger word ends.
    expect(markers[0].contentStartMs).toBe(2400);

    const blocks = buildTranscriptBlocks(stream, markers);
    const chorus = blocks.find((b) => b.marker.kind === "chorus");
    expect(chorus?.text).toBe("lifted high");
    for (const block of blocks) {
      expect(block.text).not.toMatch(/\b(okay|this|is|the)\b/);
    }
  });

  it("lets manual markers win near-conflicts", () => {
    const markers = detectSectionMarkers(
      [w("Chorus", 1000), w("oh", 1200)],
      [
        {
          atMs: 1050,
          kind: "bridge",
          source: "manual",
          label: "Bridge",
        },
      ],
    );
    expect(markers).toHaveLength(1);
    expect(markers[0].source).toBe("manual");
    expect(markers[0].kind).toBe("bridge");
  });
});

describe("buildTranscriptBlocks", () => {
  it("creates an Idea block when no markers exist", () => {
    const blocks = buildTranscriptBlocks([w("hello", 0), w("world", 300)], []);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].marker.label).toBe("Idea");
    expect(blocks[0].text).toBe("hello world");
  });

  it("splits words at marker boundaries", () => {
    const words = [
      w("Verse", 0),
      w("one", 200),
      w("morning", 500),
      w("Chorus", 2000),
      w("rise", 2300),
    ];
    const markers = detectSectionMarkers(words);
    const blocks = buildTranscriptBlocks(words, markers);
    expect(blocks.map((b) => b.marker.label)).toEqual(["Verse 1", "Chorus"]);
    // Marker word "Chorus" is now stripped from the section body.
    expect(blocks[1].text).toBe("rise");
  });
});