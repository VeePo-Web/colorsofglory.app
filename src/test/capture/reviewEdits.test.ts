import { describe, expect, it } from "vitest";
import {
  confirmCandidateSplit,
  moveCaretLine,
  splitBlockAtChar,
  type EditableBlockLike,
} from "@/lib/capture/reviewEdits";

/**
 * F12 Step 8 — Descript-grade correction operations. Every fix is one gesture
 * and non-destructive: blocks are reshaped copies; nothing raw is touched.
 */

let seq = 0;
const makeId = () => `new-${++seq}`;

function block(partial: Partial<EditableBlockLike> & { id: string }): EditableBlockLike {
  return {
    kind: "lyrics",
    section_kind: "verse",
    label: "Verse 1",
    text: "",
    start_ms: 0,
    end_ms: 0,
    ...partial,
  };
}

describe("splitBlockAtChar", () => {
  it("splits at a word boundary and divides the time range proportionally", () => {
    const blocks = [
      block({ id: "a", text: "grace in the waiting grows deeper still", start_ms: 0, end_ms: 8000 }),
    ];
    const out = splitBlockAtChar(blocks, "a", 21, makeId); // inside "waiting|grows" area
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe("grace in the waiting");
    expect(out[1].text).toBe("grows deeper still");
    expect(out[0].end_ms).toBe(out[1].start_ms);
    expect(out[1].start_ms).toBeGreaterThan(0);
    expect(out[1].end_ms).toBe(8000);
    // The second half keeps the section identity — relabeling is optional.
    expect(out[1].section_kind).toBe("verse");
  });

  it("refuses a split that would create an empty half", () => {
    const blocks = [block({ id: "a", text: "short line", start_ms: 0, end_ms: 100 })];
    expect(splitBlockAtChar(blocks, "a", 0, makeId)).toBe(blocks);
    expect(splitBlockAtChar(blocks, "a", 10, makeId)).toBe(blocks);
  });
});

describe("moveCaretLine", () => {
  const three = () => [
    block({ id: "a", label: "Verse 1", text: "line one\nline two" }),
    block({ id: "b", label: "Chorus", text: "chorus line" }),
    block({ id: "c", label: "Bridge", text: "bridge line" }),
  ];

  it("sends the caret's line down into the next block", () => {
    // Caret inside "line two" (offset 12 > "line one\n".length).
    const out = moveCaretLine(three(), "a", 12, 1);
    expect(out[0].text).toBe("line one");
    expect(out[1].text).toBe("line two\nchorus line");
  });

  it("sends the caret's line up into the previous block", () => {
    const out = moveCaretLine(three(), "b", 3, -1);
    expect(out[0].text).toBe("line one\nline two\nchorus line");
    expect(out[1].text).toBe("");
  });

  it("no-ops at the list edges", () => {
    const blocks = three();
    expect(moveCaretLine(blocks, "a", 0, -1)).toBe(blocks);
    expect(moveCaretLine(blocks, "c", 0, 1)).toBe(blocks);
  });
});

describe("confirmCandidateSplit", () => {
  it("splits the block containing the flagged moment and labels the new section", () => {
    const blocks = [
      block({
        id: "a",
        label: "Idea",
        section_kind: null,
        kind: "idea",
        text: "one two three four five six seven eight",
        start_ms: 0,
        end_ms: 8000,
      }),
    ];
    const out = confirmCandidateSplit(blocks, { atMs: 4000, label: "Chorus", kind: "chorus" }, makeId);
    expect(out).toHaveLength(2);
    expect(out[0].end_ms).toBe(4000);
    expect(out[1]).toMatchObject({
      kind: "lyrics",
      section_kind: "chorus",
      label: "Chorus",
      start_ms: 4000,
      end_ms: 8000,
    });
    // Both halves keep real text — nothing lost.
    expect(`${out[0].text} ${out[1].text}`.split(" ").filter(Boolean)).toHaveLength(8);
  });

  it("falls back to the nearest block when timings do not line up (server vs live)", () => {
    const blocks = [
      block({ id: "a", text: "alpha beta gamma delta", start_ms: 0, end_ms: 2000 }),
      block({ id: "b", text: "epsilon zeta eta theta", start_ms: 2000, end_ms: 4000 }),
    ];
    const out = confirmCandidateSplit(blocks, { atMs: 9999, label: "Bridge", kind: "bridge" }, makeId);
    // Applied to the nearest (second) block — visibly landed, honestly approximate.
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.some((b) => b.label === "Bridge")).toBe(true);
  });
});
