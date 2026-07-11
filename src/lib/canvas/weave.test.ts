import { describe, expect, it } from "vitest";
import {
  buildTargetView,
  buildWeaveContext,
  isWeaveCandidate,
  lineKeyOf,
  scoreLineFit,
  tierOf,
  weaveCandidates,
  STRONG_FIT,
  WARM_FIT,
} from "./weave";
import type { CanvasBoardCard } from "@/lib/canvas/canvasTypes";

// Lyrics chosen to be TRUE under the spelling heuristic ("grace"/"place" is
// rhyme.ts's own documented aligned pair) — the engine is honest, not psychic.
const CHORUS_BODY = "You lead me to a quiet place\nI am covered by Your grace";

const card = (over: Partial<CanvasBoardCard>): CanvasBoardCard => ({
  id: "c1",
  tree: "ideas",
  type: "lyric",
  title: "Idea",
  body: "",
  meta: "",
  section: "",
  contributor: "Parker",
  status: "raw",
  accent: "#B8953A",
  x: 0,
  y: 0,
  ...over,
});

describe("scoreLineFit", () => {
  const ctx = buildWeaveContext("Chorus", CHORUS_BODY);

  it("ranks a perfect rhyme above no rhyme", () => {
    const perfect = scoreLineFit("I can see You face to face", ctx);
    const none = scoreLineFit("Walking down the mountain road", ctx);
    expect(perfect.rhyme?.kind).toBe("perfect");
    expect(perfect.score).toBeGreaterThan(none.score);
    expect(none.rhyme).toBeNull();
  });

  it("rewards meter closeness to the section's median", () => {
    const close = scoreLineFit("Standing on the shore again", ctx); // ~7 syllables
    const far = scoreLineFit(
      "There is an everlasting overwhelming testimony of the faithfulness",
      ctx,
    );
    expect(Math.abs(close.syllableDelta)).toBeLessThan(Math.abs(far.syllableDelta));
    expect(close.score).toBeGreaterThan(far.score);
  });

  it("rewards shared theme words (stemmed), meter held equal", () => {
    // "covering" stems to "cover" = the section's "covered"; the control line
    // has the same syllable count and the same (non-)rhyme, so only theme moves.
    const themed = scoreLineFit("Standing in Your grace tonight", ctx);
    expect(themed.themeWords).toContain("grace");
    const plain = scoreLineFit("Standing in the rain tonight", ctx);
    expect(themed.score).toBeGreaterThan(plain.score);
    const stemmed = scoreLineFit("Covering me through the night", ctx);
    expect(stemmed.themeWords).toContain("covering");
  });

  it("gives an empty section a uniform faint invitation, never a fake ranking", () => {
    const empty = buildWeaveContext("Bridge", "");
    const a = scoreLineFit("Any line at all", empty);
    const b = scoreLineFit("Completely different words here", empty);
    expect(a.score).toBe(b.score);
    expect(a.tier).toBe("faint");
    expect(a.reason).toMatch(/empty/i);
  });

  it("always explains the glow in human words", () => {
    const fit = scoreLineFit("I can see You face to face", ctx);
    expect(fit.reason).toMatch(/rhymes with/);
    expect(fit.reason).toMatch(/syllable/);
  });

  it("never exceeds 1 and never gates (score present even at zero fit)", () => {
    const fit = scoreLineFit("zzz gvxq", ctx);
    expect(fit.score).toBeGreaterThanOrEqual(0);
    expect(fit.score).toBeLessThanOrEqual(1);
  });
});

describe("tierOf", () => {
  it("bands scores into strong / warm / faint", () => {
    expect(tierOf(STRONG_FIT)).toBe("strong");
    expect(tierOf(WARM_FIT)).toBe("warm");
    expect(tierOf(WARM_FIT - 0.01)).toBe("faint");
  });
});

describe("weaveCandidates", () => {
  const target = card({ id: "t1", tree: "final", type: "section", section: "Chorus", body: CHORUS_BODY });

  it("scores idea-tree lyric lines and skips empty, final, dimmed, layered, voice cards", () => {
    const cards: CanvasBoardCard[] = [
      target,
      card({ id: "a", body: "I can see You face to face\nWalking down the road" }),
      card({ id: "b", tree: "final", body: "In the final tree" }),
      card({ id: "c", isDimmedReference: true, body: "Merged away" }),
      card({ id: "d", type: "voice", body: "A voice memo" }),
      card({ id: "e", body: "" }),
      card({ id: "f", parentMemoId: "a", body: "A layer" }),
    ];
    const map = weaveCandidates(cards, target);
    expect([...map.keys()]).toEqual(["a"]);
    expect(map.get("a")).toHaveLength(2);
    expect(map.get("a")![0].fit.rhyme?.kind).toBe("perfect");
  });

  it("never includes the target itself", () => {
    expect(isWeaveCandidate(target, target.id)).toBe(false);
  });
});

describe("buildTargetView (ribbon + meter)", () => {
  it("labels the rhyme scheme and counts syllables per line", () => {
    const view = buildTargetView(`${CHORUS_BODY}\nGrace like rain`);
    expect(view.scheme).toEqual(["A", "A", "B"]);
    expect(view.syllables).toHaveLength(3);
    expect(view.medianSyllables).toBeGreaterThan(0);
  });

  it("flags meter drift only at a real distance, never on short sections", () => {
    const steady = buildTargetView("I will wait for You\nYour love will see me through");
    expect(steady.drift.every((d) => !d)).toBe(true);
    const drifting = buildTargetView(
      "Grace\nYour everlasting faithfulness is overwhelming all my days",
    );
    expect(drifting.drift.some(Boolean)).toBe(true);
  });

  it("is safe on an empty body", () => {
    const view = buildTargetView("");
    expect(view.lines).toEqual([]);
    expect(view.scheme).toEqual([]);
  });
});

describe("lineKeyOf", () => {
  it("is stable across whitespace + case but distinct across cards", () => {
    expect(lineKeyOf("a", "  Grace like  RAIN ")).toBe(lineKeyOf("a", "grace like rain"));
    expect(lineKeyOf("a", "grace")).not.toBe(lineKeyOf("b", "grace"));
  });
});
