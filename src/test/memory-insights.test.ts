import { describe, expect, it } from "vitest";
import { buildInsights, tokenize } from "@/lib/memory/insights";
import { buildMemoryGraph } from "@/lib/memory/buildGraph";
import { buildVault } from "@/lib/memory/obsidianVault";
import type { MemoryRawBundle } from "@/lib/memory/memoryTypes";

function bundle(): MemoryRawBundle {
  return {
    userId: "me",
    songs: [
      { id: "s1", title: "Grace in the Waiting", coverColor: null, status: "draft", keySignature: "G", tempoBpm: 72, tags: ["Grace"], createdAt: "2026-06-01T00:00:00Z", lastActivityAt: null },
      { id: "s2", title: "Steadfast", coverColor: null, status: "draft", keySignature: null, tempoBpm: null, tags: ["grace"], createdAt: "2026-05-01T00:00:00Z", lastActivityAt: null },
    ],
    sections: [{ id: "sec1", songId: "s1", kind: "verse", label: "Verse 1", position: 0 }],
    notes: [{ id: "n1", songId: "s1", body: "Grace again — don't rush the bridge", sectionId: null }],
    ideas: [
      { id: "i1", songId: "s1", title: "Hum", lyricSnippet: "Grace upon grace", scriptureRef: "Psalm 23", tags: ["grace"] },
      { id: "i2", songId: "s2", title: null, lyricSnippet: null, scriptureRef: "psalm 23", tags: [] },
      { id: "i3", songId: "s2", title: null, lyricSnippet: null, scriptureRef: "John 3:16", tags: [] },
    ],
    people: [
      { songId: "s1", userId: "me", role: "owner", name: "Me", initials: "ME", color: null },
      { songId: "s1", userId: "u2", role: "collaborator", name: "Sarah", initials: "SA", color: "#53AB8B" },
      { songId: "s2", userId: "u2", role: "collaborator", name: "Sarah", initials: "SA", color: "#53AB8B" },
    ],
    voiceMemos: [{ id: "v1", songId: "s1", title: "Idea" }],
    lyrics: [
      { songId: "s1", sectionId: "sec1", text: "Amazing grace how sweet the sound\nGrace will lead me home" },
    ],
  };
}

describe("tokenize", () => {
  it("lowercases, collapses apostrophes, splits on non-letters", () => {
    expect(tokenize("Don't rush — the Bridge!")).toEqual(["dont", "rush", "the", "bridge"]);
  });

  it("keeps non-English worship words whole (Spanish/Portuguese/French)", () => {
    expect(tokenize("Tu amor por mi corazón")).toEqual(["tu", "amor", "por", "mi", "corazón"]);
    expect(tokenize("Santo, Espírito")).toEqual(["santo", "espírito"]);
    // Decomposed accent (e + U+0301) normalises to the same token as precomposed.
    expect(tokenize("café")).toEqual(["café"]);
  });

  it("counts an accented word by its real spelling, not a mangled fragment", () => {
    const b: MemoryRawBundle = {
      userId: "me", songs: [], sections: [], notes: [], ideas: [], people: [], voiceMemos: [],
      lyrics: [{ songId: "s1", sectionId: "sec1", text: "corazón\ncorazón mío" }],
    };
    const i = buildInsights(b);
    expect(i.topWords.find((w) => w.word === "corazón")?.count).toBe(2);
    expect(i.topWords.find((w) => w.word === "coraz")).toBeUndefined();
  });
});

describe("buildInsights", () => {
  const insights = buildInsights(bundle());

  it("counts word recurrence across lyrics, idea fragments, and notes", () => {
    const grace = insights.topWords.find((w) => w.word === "grace");
    // 2 in lyrics + 2 in the idea snippet + 1 in the note = 5
    expect(grace?.count).toBe(5);
  });

  it("filters stopwords and one-off words", () => {
    expect(insights.topWords.find((w) => w.word === "the")).toBeUndefined();
    expect(insights.topWords.find((w) => w.word === "amazing")).toBeUndefined(); // count 1
  });

  it("counts scripture MENTIONS with case-insensitive normalisation", () => {
    const psalm = insights.scriptures.find((s) => s.label === "Psalm 23");
    expect(psalm?.count).toBe(2); // "Psalm 23" + "psalm 23"
    expect(insights.scriptures.find((s) => s.label === "John 3:16")?.count).toBe(1);
    expect(insights.scriptures[0].label).toBe("Psalm 23"); // sorted by count desc
  });

  it("counts theme occurrences across song tags and idea tags", () => {
    const grace = insights.themes.find((t) => t.label === "Grace");
    expect(grace?.count).toBe(3); // s1 tag + s2 tag + i1 tag
  });

  it("reports totals including every written word and lyric line", () => {
    expect(insights.totals.songs).toBe(2);
    expect(insights.totals.ideas).toBe(3);
    expect(insights.totals.notes).toBe(1);
    expect(insights.totals.voiceMemos).toBe(1);
    expect(insights.totals.lyricLines).toBe(2);
    expect(insights.totals.wordsWritten).toBeGreaterThan(15); // stopwords included
    // vocabulary = distinct meaningful words; at least as many as recurring ones.
    expect(insights.totals.uniqueWords).toBeGreaterThanOrEqual(insights.topWords.length);
    expect(insights.topWords.every((w) => w.count >= 2)).toBe(true);
  });

  it("counts collaborators by shared songs and excludes the current user", () => {
    expect(insights.collaborators).toHaveLength(1);
    expect(insights.collaborators[0].label).toBe("Sarah");
    expect(insights.collaborators[0].count).toBe(2); // s1 + s2
  });

  it("counts key signatures across songs", () => {
    const g = insights.keys.find((k) => k.label === "G");
    expect(g?.count).toBe(1); // only s1 has a key
    expect(insights.keys).toHaveLength(1);
  });

  it("summarises tempo across songs that have a BPM", () => {
    expect(insights.tempo).toEqual({ songs: 1, min: 72, max: 72, average: 72 }); // only s1 has 72
  });

  it("reports writing cadence — active months and busiest (ties → most recent)", () => {
    // s1 -> 2026-06, s2 -> 2026-05: two active months, 1 song each, tie -> June.
    expect(insights.cadence).toEqual({ activeMonths: 2, busiest: { label: "June 2026", count: 1 } });
  });

  it("returns null tempo with no BPMs, and averages a real range", () => {
    const withTempos = (...bpms: (number | null)[]): MemoryRawBundle => ({
      userId: "me",
      songs: bpms.map((tempoBpm, i) => ({
        id: `s${i}`, title: `S${i}`, coverColor: null, status: "draft",
        keySignature: null, tempoBpm, tags: [], createdAt: "2026-06-01T00:00:00Z", lastActivityAt: null,
      })),
      sections: [], notes: [], ideas: [], people: [], voiceMemos: [], lyrics: [],
    });
    expect(buildInsights(withTempos(null)).tempo).toBeNull();
    expect(buildInsights(withTempos(68, 140)).tempo).toEqual({ songs: 2, min: 68, max: 140, average: 104 });
  });

  it("cadence picks the month with the most songs, and is null with no dated songs", () => {
    const song = (id: string, createdAt: string | null) => ({
      id, title: id, coverColor: null, status: "draft", keySignature: null,
      tempoBpm: null, tags: [], createdAt: createdAt ?? "", lastActivityAt: null,
    });
    const base = { userId: "me", sections: [], notes: [], ideas: [], people: [], voiceMemos: [], lyrics: [] };
    const busy = buildInsights({
      ...base,
      songs: [song("a", "2026-03-01T00:00:00Z"), song("b", "2026-03-20T00:00:00Z"), song("c", "2026-07-01T00:00:00Z")],
    });
    // March has 2, July has 1 -> March wins outright.
    expect(busy.cadence).toEqual({ activeMonths: 2, busiest: { label: "March 2026", count: 2 } });
    // No valid createdAt -> null cadence (no crash).
    expect(buildInsights({ ...base, songs: [song("x", null)] }).cadence).toBeNull();
  });

  it("survives an old snapshot bundle with no lyrics field", () => {
    const old = bundle();
    delete (old as Partial<MemoryRawBundle>).lyrics;
    const i = buildInsights(old);
    expect(i.totals.lyricLines).toBe(0);
    expect(i.topWords.find((w) => w.word === "grace")?.count).toBe(3); // snippet + note only
  });

  it("is deterministic: same bundle, identical output", () => {
    expect(buildInsights(bundle())).toEqual(buildInsights(bundle()));
  });
});

describe("vault Insights note", () => {
  it("ships Insights.md with counts and wikilinked scripture", () => {
    const b = bundle();
    const files = buildVault(buildMemoryGraph(b), b);
    const note = files.find((f) => f.path === "Insights.md")!;
    expect(note).toBeTruthy();
    expect(note.content).toContain("## Words you return to");
    expect(note.content).toContain("- grace — 5");
    expect(note.content).toContain("[[Psalm 23]] — 2 mentions");
    expect(note.content).toContain("Vocabulary:");
    expect(note.content).toContain("## Who you write with");
    expect(note.content).toContain("[[Sarah]] — 2 songs");
    expect(note.content).toContain("## Keys you write in");
    expect(note.content).toContain("- G — 1 song");
    expect(note.content).toContain("## Tempo");
    expect(note.content).toContain("72 BPM");
    expect(note.content).toContain("## When you write");
    expect(note.content).toContain("[[June 2026]]");

    const home = files.find((f) => f.path === "Your Memory.md")!;
    expect(home.content).toContain("[[Insights]]");
  });
});
