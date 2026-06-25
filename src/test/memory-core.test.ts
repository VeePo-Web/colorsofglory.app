import { describe, it, expect } from "vitest";
import { buildMemoryGraph, buildSongMemory, normaliseKey } from "@/lib/memory/buildGraph";
import { buildVault, sanitizeFileName, tagToken } from "@/lib/memory/obsidianVault";
import { createZip, crc32 } from "@/lib/memory/zip";
import type { MemoryRawBundle } from "@/lib/memory/memoryTypes";

function bundle(): MemoryRawBundle {
  return {
    userId: "me",
    songs: [
      { id: "s1", title: "Grace in the Waiting", coverColor: "#B8953A", status: "draft", keySignature: "G", tempoBpm: 72, tags: ["Grace", "waiting"], createdAt: "2026-06-01T00:00:00Z", lastActivityAt: "2026-06-10T00:00:00Z" },
      { id: "s2", title: "Steadfast", coverColor: null, status: "draft", keySignature: "D", tempoBpm: null, tags: ["grace"], createdAt: "2026-05-01T00:00:00Z", lastActivityAt: null },
      { id: "s3", title: "Alone Song", coverColor: null, status: "draft", keySignature: null, tempoBpm: null, tags: [], createdAt: "2026-04-01T00:00:00Z", lastActivityAt: null },
    ],
    sections: [{ id: "sec1", songId: "s1", kind: "verse", label: "Verse 1", position: 0 }],
    notes: [{ id: "n1", songId: "s1", body: "remember the bridge", sectionId: null }],
    ideas: [
      { id: "i1", songId: "s1", title: "Hum", lyricSnippet: "He leads me", scriptureRef: "Psalm 23", tags: ["grace"] },
      { id: "i2", songId: "s2", title: null, lyricSnippet: "steady", scriptureRef: "Psalm 23", tags: [] },
    ],
    people: [
      { songId: "s1", userId: "me", role: "owner", name: "Me", initials: "ME", color: "#000" },
      { songId: "s1", userId: "u2", role: "collaborator", name: "Sarah", initials: "SA", color: "#53AB8B" },
      { songId: "s2", userId: "u2", role: "collaborator", name: "Sarah", initials: "SA", color: "#53AB8B" },
    ],
    voiceMemos: [{ id: "v1", songId: "s1", title: "Idea 1" }],
  };
}

describe("normaliseKey", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normaliseKey("  GRACE  ")).toBe("grace");
    expect(normaliseKey("Psalm   23")).toBe("psalm 23");
  });
});

describe("buildMemoryGraph", () => {
  const g = buildMemoryGraph(bundle());

  it("clusters the 'grace' theme across both songs despite casing", () => {
    const grace = g.themes.find((t) => t.label === "Grace");
    expect(grace).toBeTruthy();
    expect(grace!.songIds.sort()).toEqual(["s1", "s2"]);
    expect(grace!.recurring).toBe(true);
  });

  it("clusters Psalm 23 across both songs from idea captures", () => {
    const ps = g.scriptures.find((s) => s.label === "Psalm 23");
    expect(ps!.count).toBe(2);
    expect(ps!.recurring).toBe(true);
  });

  it("treats collaborators (not the current user) as people clusters", () => {
    expect(g.people).toHaveLength(1);
    expect(g.people[0].label).toBe("Sarah");
    expect(g.people[0].count).toBe(2);
    expect(g.people[0].color).toBe("#53AB8B");
  });

  it("orders clusters recurring-first, then by reach", () => {
    expect(g.clusters[0].recurring).toBe(true);
  });

  it("reports stats", () => {
    expect(g.stats.songCount).toBe(3);
    expect(g.stats.ideaCount).toBe(2);
  });
});

describe("buildSongMemory", () => {
  it("surfaces related songs with plain-language reasons", () => {
    const g = buildMemoryGraph(bundle());
    const sm = buildSongMemory(g, "s1")!;
    expect(sm.song.title).toBe("Grace in the Waiting");
    const related = sm.related.find((r) => r.songId === "s2")!;
    expect(related.reasons).toEqual(expect.arrayContaining(["Shares Grace", "Both use Psalm 23", "With Sarah"]));
  });

  it("returns no related songs for an unconnected song", () => {
    const g = buildMemoryGraph(bundle());
    const sm = buildSongMemory(g, "s3")!;
    expect(sm.related).toHaveLength(0);
  });

  it("returns null for an unknown song id", () => {
    const g = buildMemoryGraph(bundle());
    expect(buildSongMemory(g, "nope")).toBeNull();
  });
});

describe("obsidian vault", () => {
  it("sanitizes illegal filename chars and tag tokens", () => {
    expect(sanitizeFileName("Psalm 23:1")).toBe("Psalm 23 1");
    expect(sanitizeFileName("a/b\\c")).toBe("a b c");
    expect(tagToken("Holy Spirit")).toBe("holy-spirit");
  });

  it("produces an index note, a note per song, and cluster notes with wikilinks", () => {
    const b = bundle();
    const files = buildVault(buildMemoryGraph(b), b);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("Your Memory.md");
    expect(paths).toContain("Songs/Grace in the Waiting.md");
    expect(paths).toContain("Themes/Grace.md");
    expect(paths).toContain("Scriptures/Psalm 23.md");
    expect(paths).toContain("People/Sarah.md");

    const song = files.find((f) => f.path === "Songs/Grace in the Waiting.md")!;
    expect(song.content).toContain("# Grace in the Waiting");
    expect(song.content).toContain("[[Psalm 23]]");
    expect(song.content).toContain("[[Sarah]]");
    expect(song.content).toMatch(/^---\n/); // YAML frontmatter
    expect(song.content).toContain("key: \"G\"");

    const theme = files.find((f) => f.path === "Themes/Grace.md")!;
    expect(theme.content).toContain("[[Grace in the Waiting]]");
    expect(theme.content).toContain("[[Steadfast]]");
  });

  it("promotes each idea to an atomic, interlinked Zettel", () => {
    const b = bundle();
    const files = buildVault(buildMemoryGraph(b), b);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("Ideas/Hum.md");
    expect(paths).toContain("Ideas/steady.md");

    const hum = files.find((f) => f.path === "Ideas/Hum.md")!;
    expect(hum.content).toContain("type: idea");
    expect(hum.content).toContain("# Hum");
    expect(hum.content).toContain("> He leads me"); // creative content as a blockquote
    expect(hum.content).toContain("**From song:** [[Grace in the Waiting]]");
    expect(hum.content).toContain("**Scripture:** [[Psalm 23]]");
    expect(hum.content).toContain("**Themes:** [[Grace]]");
  });

  it("links song notes OUT to their atomic idea notes (not inline text)", () => {
    const b = bundle();
    const files = buildVault(buildMemoryGraph(b), b);
    const song = files.find((f) => f.path === "Songs/Grace in the Waiting.md")!;
    expect(song.content).toContain("## Ideas");
    expect(song.content).toContain("- [[Hum]]");
  });

  it("gathers atomic ideas under their theme and scripture cluster notes", () => {
    const b = bundle();
    const files = buildVault(buildMemoryGraph(b), b);
    const grace = files.find((f) => f.path === "Themes/Grace.md")!;
    expect(grace.content).toContain("- [[Hum]]");
    const psalm = files.find((f) => f.path === "Scriptures/Psalm 23.md")!;
    expect(psalm.content).toContain("- [[Hum]]");
    expect(psalm.content).toContain("- [[steady]]");
  });

  it("ships Maps of Content and a Start Here guide", () => {
    const b = bundle();
    const files = buildVault(buildMemoryGraph(b), b);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("Start Here.md");
    expect(paths).toContain("All Themes.md");
    expect(paths).toContain("All Scripture.md");
    expect(paths).toContain("Collaborators.md");
    expect(paths).toContain("All Ideas.md");

    const ideasMoc = files.find((f) => f.path === "All Ideas.md")!;
    expect(ideasMoc.content).toContain("## [[Grace in the Waiting]]");
    expect(ideasMoc.content).toContain("- [[Hum]]");

    const home = files.find((f) => f.path === "Your Memory.md")!;
    expect(home.content).toContain("[[Start Here]]");
    expect(home.content).toContain("[[All Ideas]]");
  });

  it("builds a Timeline MOC and dated journal notes from song start dates", () => {
    const b = bundle();
    const files = buildVault(buildMemoryGraph(b), b);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("Timeline.md");
    expect(paths).toContain("Journal/2026-06.md");
    expect(paths).toContain("Journal/2026-05.md");
    expect(paths).toContain("Journal/2026-04.md");

    const timeline = files.find((f) => f.path === "Timeline.md")!;
    expect(timeline.content).toContain("[[2026-06|June 2026]]"); // newest first, aliased link
    expect(timeline.content.indexOf("2026-06")).toBeLessThan(timeline.content.indexOf("2026-04"));

    const june = files.find((f) => f.path === "Journal/2026-06.md")!;
    expect(june.content).toContain("# June 2026");
    expect(june.content).toContain("- [[Grace in the Waiting]]");

    const home = files.find((f) => f.path === "Your Memory.md")!;
    expect(home.content).toContain("[[Timeline]]");
  });

  it("emits a valid JSON Canvas board linking songs to their threads", () => {
    const b = bundle();
    const files = buildVault(buildMemoryGraph(b), b);
    const canvas = files.find((f) => f.path === "Memory Map.canvas")!;
    expect(canvas).toBeTruthy();
    const data = JSON.parse(canvas.content) as {
      nodes: Array<{ id: string; type: string; file: string }>;
      edges: Array<{ fromNode: string; toNode: string }>;
    };
    // A song node and a theme node, both pointing at real vault files.
    expect(data.nodes.find((n) => n.id === "song:s1")?.file).toBe("Songs/Grace in the Waiting.md");
    const graceTheme = data.nodes.find((n) => n.file === "Themes/Grace.md");
    expect(graceTheme).toBeTruthy();
    // Grace connects s1 -> Grace theme node.
    expect(data.edges.some((e) => e.fromNode === "song:s1" && e.toNode === graceTheme!.id)).toBe(true);
  });

  it("deterministically disambiguates colliding idea names", () => {
    const b = bundle();
    b.ideas = [
      { id: "a", songId: "s1", title: "Bridge", lyricSnippet: null, scriptureRef: null, tags: [] },
      { id: "b", songId: "s1", title: "Bridge", lyricSnippet: null, scriptureRef: null, tags: [] },
    ];
    const files = buildVault(buildMemoryGraph(b), b);
    const paths = files.map((f) => f.path);
    expect(paths).toContain("Ideas/Bridge.md");
    expect(paths).toContain("Ideas/Bridge (2).md");
  });
});

describe("createZip", () => {
  it("computes a known CRC32 (ISO-HDLC) for 'hello world'", () => {
    const bytes = new TextEncoder().encode("hello world");
    expect(crc32(bytes)).toBe(0x0d4a1185);
  });

  it("writes a valid local-file and EOCD signature and counts entries", () => {
    const zip = createZip([
      { path: "a.md", text: "# A" },
      { path: "dir/b.md", text: "bee" },
    ]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50); // first local file header
    // EOCD lives in the last 22 bytes (no archive comment).
    const eocd = zip.length - 22;
    expect(view.getUint32(eocd, true)).toBe(0x06054b50);
    expect(view.getUint16(eocd + 10, true)).toBe(2); // total entries
  });
});
