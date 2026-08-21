import { describe, expect, it } from "vitest";
import { buildSectionTakes, type PracticeMemoRow, type PracticeTranscriptRow } from "./practiceApi";

const row = (over: Partial<PracticeMemoRow> & { id: string }): PracticeMemoRow => ({
  section_id: null,
  duration_ms: 10_000,
  title: null,
  created_at: "2026-08-01T00:00:00Z",
  ...over,
});

const noTx = new Map<string, PracticeTranscriptRow>();

describe("buildSectionTakes — the seam that lets practice hear the whole song", () => {
  it("attaches layers to their base as ONE take (never as swipeable alternates)", () => {
    const takes = buildSectionTakes(
      [
        row({ id: "base", section_id: "chorus", title: "Chorus melody" }),
        row({
          id: "harm",
          section_id: "chorus",
          parent_memo_id: "base",
          title: "Harmony",
          layer_gain: 0.7,
          layer_muted: false,
          layer_offset_ms: 120,
          author_user_id: "sarah",
          created_at: "2026-08-02T00:00:00Z",
        }),
      ],
      noTx,
    );
    const chorus = takes.get("chorus")!;
    expect(chorus).toHaveLength(1); // one take, not two
    expect(chorus[0].memoId).toBe("base");
    expect(chorus[0].layers).toHaveLength(1);
    expect(chorus[0].layers![0]).toMatchObject({
      memoId: "harm",
      gain: 0.7,
      muted: false,
      offsetMs: 120,
      authorId: "sarah",
    });
  });

  it("a layer follows its BASE's section — its own section_id may be null/stale", () => {
    // "Sing over this" skips the section decision, so layers often carry
    // section_id null. Grouping per-section would tear the harmony away from
    // its base into a phantom take on a phantom section.
    const takes = buildSectionTakes(
      [
        row({ id: "base", section_id: "verse-1" }),
        row({ id: "layer", section_id: null, parent_memo_id: "base", created_at: "2026-08-03T00:00:00Z" }),
      ],
      noTx,
    );
    expect(takes.get("verse-1")![0].layers!.map((l) => l.memoId)).toEqual(["layer"]);
    expect(takes.get(null)).toBeUndefined(); // nothing phantom
  });

  it("an ORPHAN layer promotes to its own take — never dropped", () => {
    const takes = buildSectionTakes(
      [row({ id: "orphan", section_id: "bridge", parent_memo_id: "gone" })],
      noTx,
    );
    expect(takes.get("bridge")![0].memoId).toBe("orphan");
  });

  it("two bases on one section stay two takes (F15 alternates), each with its own family", () => {
    const takes = buildSectionTakes(
      [
        row({ id: "a", section_id: "chorus" }),
        row({ id: "b", section_id: "chorus", created_at: "2026-08-02T00:00:00Z" }),
        row({ id: "a-layer", parent_memo_id: "a", created_at: "2026-08-03T00:00:00Z" }),
      ],
      noTx,
    );
    const chorus = takes.get("chorus")!;
    expect(chorus.map((t) => t.memoId)).toEqual(["a", "b"]);
    expect(chorus[0].layers!.map((l) => l.memoId)).toEqual(["a-layer"]);
    expect(chorus[1].layers).toEqual([]);
  });

  it("seed mix defaults are safe: gain 1, unmuted, zero offset", () => {
    const takes = buildSectionTakes(
      [
        row({ id: "base", section_id: "s" }),
        row({ id: "l", parent_memo_id: "base", layer_offset_ms: -50, created_at: "2026-08-02T00:00:00Z" }),
      ],
      noTx,
    );
    expect(takes.get("s")![0].layers![0]).toMatchObject({ gain: 1, muted: false, offsetMs: 0 });
  });

  it("the base's transcript rides the take (karaoke follows the base voice)", () => {
    const tx = new Map<string, PracticeTranscriptRow>([
      ["base", { memo_id: "base", text: "amazing grace", segments: null }],
    ]);
    const takes = buildSectionTakes([row({ id: "base", section_id: "v" })], tx);
    expect(takes.get("v")![0].lyrics).toBe("amazing grace");
    expect(takes.get("v")![0].transcriptLines).toEqual([
      { text: "amazing grace", startMs: 0, endMs: 10_000 },
    ]);
  });
});
