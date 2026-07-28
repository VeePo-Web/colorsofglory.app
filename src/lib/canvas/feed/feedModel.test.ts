import { describe, it, expect, beforeEach } from "vitest";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";
import {
  ideasFeedGroups,
  finalFeedCards,
  liveIdeaCount,
  readCanvasView,
  writeCanvasView,
  SPARKS_GROUP,
  USED_GROUP,
} from "./feedModel";

const card = (over: Partial<CanvasBoardCard>): CanvasBoardCard =>
  ({ id: "x", type: "lyric", tree: "ideas", title: "", body: "", section: "", x: 0, y: 0, contributor: "Me", ...over } as CanvasBoardCard);

describe("feedModel — the feed's organize-brain", () => {
  it("unfiled sparks first, song parts in first-seen order, used ideas last", () => {
    const groups = ideasFeedGroups([
      card({ id: "a", section: "Chorus" }),
      card({ id: "b", section: "" }),               // spark
      card({ id: "c", section: "Verse 1" }),
      card({ id: "d", section: "Raw idea" }),        // spark
      card({ id: "e", section: "Chorus" }),
      card({ id: "f", section: "Bridge", isDimmedReference: true, dimReason: "moved_to_final" }),
    ]);
    expect(groups.map((g) => g.label)).toEqual([SPARKS_GROUP, "Chorus", "Verse 1", USED_GROUP]);
    expect(groups[1].cards.map((c) => c.id)).toEqual(["a", "e"]);
    expect(groups[3].cards.map((c) => c.id)).toEqual(["f"]);
  });

  it("voice-memo layers never appear (they live in their base's stack); final cards never leak in", () => {
    const groups = ideasFeedGroups([
      card({ id: "base", type: "voice" }),
      card({ id: "layer", type: "voice", parentMemoId: "base" }),
      card({ id: "fin", tree: "final", section: "Chorus" }),
    ]);
    const ids = groups.flatMap((g) => g.cards.map((c) => c.id));
    expect(ids).toEqual(["base"]);
  });

  it("the final page is the arrangement in running order (top-to-bottom y)", () => {
    const ordered = finalFeedCards([
      card({ id: "v2", tree: "final", y: 300 }),
      card({ id: "v1", tree: "final", y: 100 }),
      card({ id: "idea", tree: "ideas" }),
      card({ id: "lyr", tree: "final", y: 200, parentMemoId: "v1" }), // layer excluded
    ]);
    expect(ordered.map((c) => c.id)).toEqual(["v1", "v2"]);
  });

  it("live idea count excludes layers and used references", () => {
    expect(
      liveIdeaCount([
        card({ id: "a" }),
        card({ id: "b", isDimmedReference: true }),
        card({ id: "c", parentMemoId: "a" }),
        card({ id: "d", tree: "final" }),
      ]),
    ).toBe(1);
  });
});

describe("feedModel — view preference", () => {
  beforeEach(() => localStorage.clear());

  it("phones default to the feed, big screens to the map", () => {
    expect(readCanvasView(390)).toBe("feed");
    expect(readCanvasView(1440)).toBe("map");
  });

  it("an explicit choice wins over the device default", () => {
    writeCanvasView("map");
    expect(readCanvasView(390)).toBe("map");
    writeCanvasView("feed");
    expect(readCanvasView(1440)).toBe("feed");
  });
});
