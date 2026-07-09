import { describe, it, expect } from "vitest";
import { buildChordLinesByLabel, normalizeSectionLabel } from "@/lib/practice/practiceApi";
import { effectiveClickBpm } from "@/hooks/usePracticePlayer";
import { DEFAULT_SPEED_TRAINER } from "@/lib/audio/practiceTypes";
import type { SheetDoc } from "@/lib/chords/sheetState";
import { parseChordProLine } from "@/lib/chords/sheet";

/**
 * F2 practice-mode pure logic: the C3 sheet → practice chord-line bridge and
 * the speed-trainer-tracking click tempo. These are the two contracts the UI
 * leans on (docs/PRACTICE-CONTRACT.md).
 */

function docWith(sections: SheetDoc["sections"], overrides: Partial<SheetDoc> = {}): SheetDoc {
  return {
    songId: "song-1",
    key: "G",
    mode: "major",
    originalKey: "G",
    capo: 0,
    display: "letters",
    sections,
    ...overrides,
  };
}

describe("normalizeSectionLabel", () => {
  it("matches labels across case, trim, and inner whitespace", () => {
    expect(normalizeSectionLabel("  Verse  1 ")).toBe("verse 1");
    expect(normalizeSectionLabel("VERSE 1")).toBe("verse 1");
    expect(normalizeSectionLabel(null)).toBe("");
  });
});

describe("buildChordLinesByLabel", () => {
  it("renders chords in the doc's key, bonded to character indices", () => {
    const line = parseChordProLine("[G]Amazing [C]grace how [D]sweet", "G", "major");
    const doc = docWith([{ id: "s1", label: "Verse 1", lines: [{ ...line, id: "l1" }] }]);

    const byLabel = buildChordLinesByLabel(doc);
    const lines = byLabel.get("verse 1");
    expect(lines).toBeDefined();
    expect(lines![0].text).toBe("Amazing grace how sweet");
    expect(lines![0].chords.map((c) => c.glyph)).toEqual(["G", "C", "D"]);
    expect(lines![0].chords.map((c) => c.at)).toEqual([0, 8, 18]);
  });

  it("first section with a label wins; unlabeled and empty sections are skipped", () => {
    const l1 = { ...parseChordProLine("[G]First chorus", "G", "major"), id: "l1" };
    const l2 = { ...parseChordProLine("[C]Second chorus", "G", "major"), id: "l2" };
    const doc = docWith([
      { id: "s1", label: "Chorus", lines: [l1] },
      { id: "s2", label: "Chorus", lines: [l2] },
      { id: "s3", label: "", lines: [l2] },
      { id: "s4", label: "Bridge", lines: [] },
    ]);

    const byLabel = buildChordLinesByLabel(doc);
    expect(byLabel.get("chorus")![0].chords[0].glyph).toBe("G");
    expect(byLabel.has("")).toBe(false);
    expect(byLabel.has("bridge")).toBe(false);
  });

  it("respects Nashville-number display mode", () => {
    const line = { ...parseChordProLine("[G]Home [Em]again", "G", "major"), id: "l1" };
    const doc = docWith([{ id: "s1", label: "Verse", lines: [line] }], { display: "numbers" });

    const glyphs = buildChordLinesByLabel(doc).get("verse")![0].chords.map((c) => c.glyph);
    expect(glyphs[0]).toContain("1");
    expect(glyphs[1]).toContain("6");
  });
});

describe("effectiveClickBpm — the metronome tracks the speed trainer", () => {
  it("uses plain playback speed when the trainer is off", () => {
    expect(
      effectiveClickBpm({ bpm: 120, playbackSpeed: 0.75, speedTrainer: { ...DEFAULT_SPEED_TRAINER } }),
    ).toBe(90);
  });

  it("follows the trainer's current speed as it ramps", () => {
    const trainer = { ...DEFAULT_SPEED_TRAINER, enabled: true, currentSpeed: 0.8 };
    expect(effectiveClickBpm({ bpm: 100, playbackSpeed: 1.0, speedTrainer: trainer })).toBe(80);
    expect(
      effectiveClickBpm({ bpm: 100, playbackSpeed: 1.0, speedTrainer: { ...trainer, currentSpeed: 0.9 } }),
    ).toBe(90);
    expect(
      effectiveClickBpm({ bpm: 100, playbackSpeed: 1.0, speedTrainer: { ...trainer, currentSpeed: 1.0 } }),
    ).toBe(100);
  });
});
