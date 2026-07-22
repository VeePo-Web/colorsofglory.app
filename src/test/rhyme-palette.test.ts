import { afterEach, describe, expect, it, vi } from "vitest";
import {
  contextTopics,
  contextWordSet,
  groupPalette,
  paletteFromCorpus,
  rankCandidates,
  suggestPalette,
  paletteIsEmpty,
  EMPTY_RHYME_CONTEXT,
  type RhymeContext,
} from "@/lib/lyrics/rhymePalette";

const CTX: RhymeContext = {
  theme: "grace mercy",
  scriptures: [
    {
      label: "Psalm 23:1",
      text: "The Lord is my shepherd; I shall not want. He makes me lie down in green pastures.",
    },
  ],
};

describe("contextWordSet — the theme/scripture compass", () => {
  it("keeps content words and drops stopwords", () => {
    const set = contextWordSet(CTX);
    expect(set.has("grace")).toBe(true);
    expect(set.has("mercy")).toBe(true);
    expect(set.has("shepherd")).toBe(true);
    expect(set.has("pastures")).toBe(true);
    expect(set.has("the")).toBe(false);
    expect(set.has("is")).toBe(false);
    expect(set.has("not")).toBe(false);
  });

  it("is empty for the empty context", () => {
    expect(contextWordSet(EMPTY_RHYME_CONTEXT).size).toBe(0);
  });
});

describe("contextTopics — Datamuse topic bias", () => {
  it("leads with the writer's theme words, capped at five", () => {
    const topics = contextTopics({
      theme: "grace mercy morning light hope anchor",
      scriptures: [],
    });
    expect(topics).toHaveLength(5);
    expect(topics[0]).toBe("grace");
    expect(topics[1]).toBe("mercy");
  });

  it("fills remaining slots from scripture content words", () => {
    const topics = contextTopics(CTX);
    expect(topics[0]).toBe("grace");
    expect(topics[1]).toBe("mercy");
    expect(topics.length).toBeGreaterThan(2);
    expect(topics.length).toBeLessThanOrEqual(5);
  });
});

describe("rankCandidates — the composite (tier × theme × meter × score)", () => {
  const raw = (text: string, lens: "rhyme" | "near" | "related", dmScore = 100) => ({
    text,
    dmScore,
    lens,
  });

  it("ranks a theme-matched near rhyme above an off-theme perfect rhyme", () => {
    // "place" is a genuine perfect rhyme for "grace" but off-theme; "mercy"
    // arrives via the near lens and IS the theme. Near weight (0.95) × theme
    // boost (1.65) beats perfect 1.0 — on-message floats first.
    const ranked = rankCandidates(
      [raw("place", "rhyme"), raw("mercy", "near")],
      "grace",
      CTX,
    );
    expect(ranked[0].text).toBe("mercy");
    expect(ranked[0].themeHit).toBe(true);
    expect(ranked.find((r) => r.text === "place")?.tier).toBe("perfect");
  });

  it("keeps related words below rhymes", () => {
    const ranked = rankCandidates(
      [raw("place", "rhyme"), raw("kindness", "related")],
      "grace",
      EMPTY_RHYME_CONTEXT,
    );
    expect(ranked[0].text).toBe("place");
    expect(ranked[ranked.length - 1].text).toBe("kindness");
  });

  it("excludes the seed itself and dedupes", () => {
    const ranked = rankCandidates(
      [raw("grace", "rhyme"), raw("place", "rhyme"), raw("place", "near")],
      "grace",
      EMPTY_RHYME_CONTEXT,
    );
    expect(ranked.map((r) => r.text)).toEqual(["place"]);
  });

  it("marks multi-word candidates as phrases and nudges them up", () => {
    const ranked = rankCandidates(
      [raw("embrace", "rhyme", 50), raw("a hiding place", "rhyme", 50)],
      "grace",
      EMPTY_RHYME_CONTEXT,
    );
    const phrase = ranked.find((r) => r.text === "a hiding place");
    expect(phrase?.phrase).toBe(true);
    expect(ranked[0].text).toBe("a hiding place");
  });

  it("lifts candidates that land the line on the meter target", async () => {
    // Compute the target from the same heuristics the ranker uses, so the
    // test asserts the RANKING math, not the syllable counter's exact output:
    // pick a target only "before" (2 syl) can land exactly; "shore" (1) is off.
    const { countLineSyllables, countSyllables } = await import("@/lib/lyrics/syllables");
    const lineText = "washed in your";
    const target =
      countLineSyllables(lineText) - countSyllables("your") + countSyllables("before");
    const ranked = rankCandidates(
      [raw("shore", "rhyme", 100), raw("before", "rhyme", 100)],
      "your",
      EMPTY_RHYME_CONTEXT,
      { lineText, meterTarget: target },
    );
    expect(ranked[0].text).toBe("before");
  });

  it("classifies tiers with the on-device classifier over the lens", () => {
    // "place" against "grace" is a perfect rhyme even if it arrived via near.
    const ranked = rankCandidates([raw("place", "near")], "grace", EMPTY_RHYME_CONTEXT);
    expect(ranked[0].tier).toBe("perfect");
  });
});

describe("groupPalette — the four calm groups", () => {
  it("routes phrases to the phrase group and words to their tier", () => {
    const ranked = rankCandidates(
      [
        { text: "place", dmScore: 10, lens: "rhyme" as const },
        { text: "a hiding place", dmScore: 10, lens: "rhyme" as const },
        { text: "kindness", dmScore: 10, lens: "related" as const },
      ],
      "grace",
      EMPTY_RHYME_CONTEXT,
    );
    const groups = groupPalette(ranked);
    expect(groups.perfect.map((c) => c.text)).toContain("place");
    expect(groups.phrase.map((c) => c.text)).toContain("a hiding place");
    expect(groups.related.map((c) => c.text)).toContain("kindness");
    expect(paletteIsEmpty(groups)).toBe(false);
  });
});

describe("paletteFromCorpus — the offline rung (the writer's own words)", () => {
  it("mines perfect and slant rhymes from the writer's material", () => {
    const groups = paletteFromCorpus(
      "grace",
      ["place", "embrace", "voice", "morning", "peace"],
      EMPTY_RHYME_CONTEXT,
    );
    expect(groups.perfect.map((c) => c.text)).toEqual(
      expect.arrayContaining(["place", "embrace"]),
    );
    expect(groups.related).toHaveLength(0);
    expect(groups.phrase).toHaveLength(0);
  });

  it("is silent (empty) for an empty seed", () => {
    expect(paletteIsEmpty(paletteFromCorpus("", ["place"], EMPTY_RHYME_CONTEXT))).toBe(true);
  });
});

describe("suggestPalette — fetch, cache, and the offline throw", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const dmResponse = (rows: Array<{ word: string; score?: number; numSyllables?: number }>) =>
    new Response(JSON.stringify(rows), { status: 200 });

  it("fetches three lenses with the theme topics and serves the cache after", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("rel_rhy")) return dmResponse([{ word: "place", score: 90, numSyllables: 1 }]);
      if (u.includes("rel_nry")) return dmResponse([{ word: "praise", score: 60, numSyllables: 1 }]);
      return dmResponse([{ word: "kindness", score: 40, numSyllables: 2 }]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const ctx: RhymeContext = { theme: "zzcachetest", scriptures: [] };
    const first = await suggestPalette("grace", ctx);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toContain("topics=zzcachetest");
    expect(first.perfect.map((c) => c.text)).toContain("place");

    await suggestPalette("grace", ctx);
    expect(fetchMock).toHaveBeenCalledTimes(3); // cache hit — no new fetches
  });

  it("throws only when every lens fails (the ladder's offline rung)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    await expect(
      suggestPalette("zzofflineseed", EMPTY_RHYME_CONTEXT),
    ).rejects.toThrow("rhyme_palette_offline");
  });

  it("degrades quietly on a partial outage (one lens up)", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes("rel_rhy")) return dmResponse([{ word: "place", score: 90 }]);
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchMock);
    const groups = await suggestPalette("zzpartialseed", EMPTY_RHYME_CONTEXT);
    expect(paletteIsEmpty(groups)).toBe(false);
  });
});
