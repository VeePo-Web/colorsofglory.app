import { describe, expect, it } from "vitest";
import {
  APPLY_CONFIDENCE_THRESHOLD,
  buildTranscriptBlocks,
  detectSectionMarkers,
  isAppliedMarker,
  pendingCandidateMarkers,
} from "@/lib/capture/sectionKeywords";
import type { TranscriptWord } from "@/lib/capture/transcriptModel";

/**
 * F12 Step 3 — command-vs-content disambiguation (the Dragon lesson).
 * A section word AFTER a real pause is an announcement; the same word running
 * mid-phrase is a lyric. Low-confidence markers are flagged, never applied.
 */

/** Continuous phrasing: words flow with ~80ms between them (sung/spoken flow). */
function flowing(spoken: string, startMs = 0): TranscriptWord[] {
  let t = startMs;
  return spoken.split(/\s+/).map((text) => {
    const w = { text, startMs: t, endMs: t + 220 };
    t += 300; // 80ms gap
    return w;
  });
}

/** Append words after a deliberate pause. */
function after(words: TranscriptWord[], pauseMs: number, spoken: string): TranscriptWord[] {
  const last = words[words.length - 1];
  return [...words, ...flowing(spoken, (last?.endMs ?? 0) + pauseMs)];
}

describe("sectionConfidence — the Dragon cases", () => {
  it("does NOT split on 'every verse of this psalm' sung mid-phrase", () => {
    const w = flowing("singing every verse of this psalm to you");
    const markers = detectSectionMarkers(w);
    const blocks = buildTranscriptBlocks(w, markers);

    // One unstructured block; the take was never restructured.
    expect(blocks).toHaveLength(1);
    expect(blocks[0].marker.kind).toBe("unlabeled");
    expect(blocks[0].text.toLowerCase()).toContain("every verse of this psalm");

    // But the doubt is HONEST: the moment is flagged for review, not dropped.
    const candidates = pendingCandidateMarkers(markers);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].kind).toBe("verse");
    expect(candidates[0].confidence!).toBeLessThan(APPLY_CONFIDENCE_THRESHOLD);
  });

  it("splits on '…[pause] verse two [pause]…' — a real announcement", () => {
    let w = flowing("grace in the waiting");
    w = after(w, 700, "verse two");
    w = after(w, 400, "grace in the waiting grows");
    const markers = detectSectionMarkers(w);
    const applied = markers.filter(isAppliedMarker);

    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({ kind: "verse", ordinal: 2, label: "Verse 2" });
    expect(applied[0].confidence!).toBeGreaterThanOrEqual(APPLY_CONFIDENCE_THRESHOLD);

    const blocks = buildTranscriptBlocks(w, markers);
    expect(blocks.map((b) => b.marker.label)).toEqual(["Idea", "Verse 2"]);
    // The announcement never leaks into the body — the invariant.
    expect(blocks[1].text.toLowerCase()).not.toMatch(/verse|two/);
    expect(blocks[1].text.toLowerCase()).toContain("grace in the waiting grows");
  });

  it("every voice marker carries a confidence score", () => {
    const w = after(flowing("hold on"), 800, "chorus lifted high");
    const markers = detectSectionMarkers(w);
    expect(markers.length).toBeGreaterThan(0);
    for (const m of markers) {
      expect(m.confidence).toBeGreaterThan(0);
      expect(m.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("manual chip markers are always applied — no confidence gate", () => {
    const manual = { atMs: 5000, kind: "bridge" as const, source: "manual" as const, label: "Bridge" };
    expect(isAppliedMarker(manual)).toBe(true);
    const w = flowing("steady words all the way through here");
    const blocks = buildTranscriptBlocks(w, detectSectionMarkers(w, [manual]));
    expect(blocks.some((b) => b.marker.label === "Bridge")).toBe(true);
  });

  it("keeps a lyric tail out of the marker across a pause ('…I am here [pause] chorus')", () => {
    let w = flowing("i am here");
    w = after(w, 800, "chorus");
    w = after(w, 300, "lifted high");
    const blocks = buildTranscriptBlocks(w, detectSectionMarkers(w));
    // "here" is a filler word, but across an 800ms pause it belongs to the lyric.
    expect(blocks[0].text.toLowerCase()).toBe("i am here");
    expect(blocks[1].marker.kind).toBe("chorus");
    expect(blocks[1].text.toLowerCase()).toBe("lifted high");
  });

  it("a low-confidence verse candidate does not shift auto-numbering", () => {
    // Verse (start) … "…every verse of…" (content) … [pause] verse [pause]
    let w = flowing("verse morning light");
    w = after(w, 60, "singing every verse of this psalm");
    w = after(w, 700, "verse");
    w = after(w, 400, "evening come");
    const markers = detectSectionMarkers(w);
    const applied = markers.filter(isAppliedMarker);
    expect(applied.map((m) => m.label)).toEqual(["Verse 1", "Verse 2"]);
  });
});
