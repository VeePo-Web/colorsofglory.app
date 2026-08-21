import { describe, expect, it } from "vitest";
import {
  buildSingItTimeline,
  partWindowFrom,
  sectionIndexAtMs,
} from "./singItEngine";
import type { PracticeSection } from "@/lib/audio/practiceTypes";

const section = (
  over: Partial<PracticeSection> & { id: string; label: string },
): PracticeSection => ({
  memoId: null,
  lyrics: null,
  transcriptLines: null,
  durationMs: 0,
  cacheStatus: "pending",
  masteryLevel: "untouched",
  loopCountThisSession: 0,
  ...over,
});

const song = (): PracticeSection[] => [
  section({
    id: "v1",
    label: "Verse 1",
    memoId: "m-v1",
    durationMs: 10_000,
    takes: [
      {
        memoId: "m-v1",
        label: "Verse 1",
        durationMs: 10_000,
        lyrics: "verse words",
        transcriptLines: null,
        layers: [],
      },
    ],
    activeTakeIndex: 0,
  }),
  section({
    id: "ch",
    label: "Chorus",
    memoId: "m-ch",
    durationMs: 8_000,
    takes: [
      {
        memoId: "m-ch",
        label: "Chorus",
        durationMs: 8_000,
        lyrics: null,
        transcriptLines: [{ text: "oh glory", startMs: 500, endMs: 2500 }],
        layers: [
          {
            memoId: "m-harm",
            label: "Harmony",
            durationMs: 7_600,
            gain: 0.7,
            muted: false,
            offsetMs: 120,
            authorId: "sarah",
          },
        ],
      },
    ],
    activeTakeIndex: 0,
  }),
];

describe("buildSingItTimeline — the whole song as one timeline", () => {
  it("places sections back to back and every voice inside its section", () => {
    const t = buildSingItTimeline(song());
    expect(t.totalMs).toBe(18_000);
    expect(t.sections.map((s) => [s.label, s.startMs, s.durationMs])).toEqual([
      ["Verse 1", 0, 10_000],
      ["Chorus", 10_000, 8_000],
    ]);
    expect(t.parts.map((p) => [p.memoId, p.sectionIndex, p.isBase])).toEqual([
      ["m-v1", 0, true],
      ["m-ch", 1, true],
      ["m-harm", 1, false],
    ]);
    // Layers carry the room-shared seed mix.
    const harm = t.parts.find((p) => p.memoId === "m-harm")!;
    expect(harm).toMatchObject({ seedGain: 0.7, seedMuted: false, offsetMs: 120 });
  });

  it("skips a section with no playable base — a hole is never a wall", () => {
    const t = buildSingItTimeline([
      section({ id: "empty", label: "Tag", memoId: null, durationMs: 0 }),
      ...song(),
    ]);
    expect(t.sections[0].label).toBe("Verse 1");
    expect(t.totalMs).toBe(18_000);
  });

  it("falls back to the section mirror when takes are absent (nav-state fast path)", () => {
    const t = buildSingItTimeline([
      section({ id: "v", label: "Verse", memoId: "m", durationMs: 5_000, lyrics: "la" }),
    ]);
    expect(t.parts).toHaveLength(1);
    expect(t.parts[0]).toMatchObject({ memoId: "m", isBase: true, seedGain: 1 });
    expect(t.sections[0].lyrics).toBe("la");
  });
});

describe("sectionIndexAtMs", () => {
  const t = buildSingItTimeline(song());
  it("maps positions to sections, clamped at the edges", () => {
    expect(sectionIndexAtMs(t, -5)).toBe(0);
    expect(sectionIndexAtMs(t, 0)).toBe(0);
    expect(sectionIndexAtMs(t, 9_999)).toBe(0);
    expect(sectionIndexAtMs(t, 10_000)).toBe(1);
    expect(sectionIndexAtMs(t, 99_999)).toBe(1);
  });
});

describe("partWindowFrom — the scheduling math", () => {
  const t = buildSingItTimeline(song());
  const base1 = t.parts[0]; // verse base, section [0, 10s)
  const harm = t.parts[2]; // chorus layer, section [10s, 18s), latency 120ms

  it("from 0: verse starts now, chorus waits its turn", () => {
    expect(partWindowFrom(t, base1, 0)).toEqual({
      delayMs: 0,
      intoPartMs: 0,
      playMs: 10_000,
    });
    expect(partWindowFrom(t, harm, 0)).toEqual({
      delayMs: 10_000,
      intoPartMs: 120, // latency: start INTO the layer's audio
      playMs: 8_000,
    });
  });

  it("seek into the chorus: the layer starts mid-buffer, latency preserved", () => {
    expect(partWindowFrom(t, harm, 13_000)).toEqual({
      delayMs: 0,
      intoPartMs: 120 + 3_000,
      playMs: 5_000,
    });
  });

  it("a part whose section is over is skipped (null)", () => {
    expect(partWindowFrom(t, base1, 10_000)).toBeNull();
  });

  it("device + server offsets merge as max() — the same measurement, never summed", () => {
    expect(partWindowFrom(t, harm, 10_000, 200)!.intoPartMs).toBe(200);
    expect(partWindowFrom(t, harm, 10_000, 50)!.intoPartMs).toBe(120);
  });
});
