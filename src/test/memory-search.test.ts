import { describe, it, expect } from "vitest";
import { buildMemoryGraph } from "@/lib/memory/buildGraph";
import { searchMemory } from "@/lib/memory/searchMemory";
import type { MemoryRawBundle } from "@/lib/memory/memoryTypes";

function bundle(): MemoryRawBundle {
  return {
    userId: "me",
    songs: [
      { id: "s1", title: "Grace in the Waiting", coverColor: null, status: "draft", keySignature: "G", tempoBpm: 72, tags: ["grace", "waiting"], createdAt: "2026-06-01T00:00:00Z", lastActivityAt: null },
      { id: "s2", title: "Steadfast", coverColor: null, status: "draft", keySignature: "D", tempoBpm: null, tags: ["grace"], createdAt: "2026-05-01T00:00:00Z", lastActivityAt: null },
    ],
    sections: [],
    notes: [],
    ideas: [
      { id: "i1", songId: "s1", title: "Bridge hum", lyricSnippet: "He leads me beside still waters", scriptureRef: "Psalm 23", tags: ["grace"] },
      { id: "i2", songId: "s2", title: null, lyricSnippet: "steady through the night", scriptureRef: null, tags: [] },
    ],
    people: [
      { songId: "s1", userId: "u2", role: "collaborator", name: "Sarah", initials: "SA", color: "#53AB8B" },
      { songId: "s2", userId: "u2", role: "collaborator", name: "Sarah", initials: "SA", color: "#53AB8B" },
    ],
    voiceMemos: [],
    lyrics: [
      { songId: "s1", sectionId: "sec1", text: "Amazing grace how sweet the sound\nthat saved a wretch like me" },
    ],
  };
}

describe("searchMemory", () => {
  const graph = buildMemoryGraph(bundle());
  const b = bundle();

  it("returns nothing for an empty/whitespace query", () => {
    expect(searchMemory(graph, b, "").total).toBe(0);
    expect(searchMemory(graph, b, "   ").total).toBe(0);
  });

  it("matches song titles", () => {
    const r = searchMemory(graph, b, "stead");
    expect(r.songs.map((h) => h.label)).toContain("Steadfast");
    expect(r.songs[0].songId).toBe("s2");
  });

  it("matches a theme cluster and carries the cluster for the source sheet", () => {
    const r = searchMemory(graph, b, "grace");
    const theme = r.themes.find((h) => h.label === "Grace");
    expect(theme).toBeTruthy();
    expect(theme!.cluster?.count).toBe(2);
  });

  it("matches scripture", () => {
    const r = searchMemory(graph, b, "psalm");
    expect(r.scriptures[0].label).toBe("Psalm 23");
  });

  it("matches people by name", () => {
    const r = searchMemory(graph, b, "sarah");
    expect(r.people[0].label).toBe("Sarah");
  });

  it("matches idea fragments (lyric snippet) and links to the parent song", () => {
    const r = searchMemory(graph, b, "still waters");
    expect(r.ideas).toHaveLength(1);
    expect(r.ideas[0].songId).toBe("s1");
    expect(r.ideas[0].sublabel).toBe("Grace in the Waiting");
  });

  it("matches lyric lines and returns the matching line + parent song", () => {
    const r = searchMemory(graph, b, "wretch");
    expect(r.lyrics).toHaveLength(1);
    expect(r.lyrics[0].songId).toBe("s1");
    expect(r.lyrics[0].sublabel).toBe("Grace in the Waiting");
    expect(r.lyrics[0].label).toContain("wretch"); // the matching line, not the whole body
    expect(r.lyrics[0].label).not.toContain("Amazing grace how sweet"); // other line excluded
  });

  it("is case-insensitive", () => {
    expect(searchMemory(graph, b, "GRACE").total).toBeGreaterThan(0);
  });
});
