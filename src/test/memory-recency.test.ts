import { describe, it, expect } from "vitest";
import { freshSongs } from "@/lib/memory/recency";
import type { MemorySong } from "@/lib/memory/memoryTypes";

function song(id: string, createdAt: string, lastActivityAt: string | null): MemorySong {
  return {
    id,
    title: `Song ${id}`,
    coverColor: null,
    status: "draft",
    keySignature: null,
    tempoBpm: null,
    tags: [],
    createdAt,
    lastActivityAt,
  };
}

describe("freshSongs", () => {
  const songs = [
    song("a", "2026-06-01T00:00:00Z", "2026-06-20T00:00:00Z"),
    song("b", "2026-06-02T00:00:00Z", null), // falls back to createdAt
    song("c", "2026-06-25T00:00:00Z", "2026-06-25T12:00:00Z"),
  ];

  it("returns nothing when there is no baseline (first visit)", () => {
    expect(freshSongs(songs, null)).toEqual([]);
  });

  it("returns only songs touched after the baseline, newest first", () => {
    const fresh = freshSongs(songs, "2026-06-10T00:00:00Z");
    expect(fresh.map((s) => s.id)).toEqual(["c", "a"]); // b's createdAt is before baseline
  });

  it("uses lastActivityAt over createdAt when present", () => {
    // baseline after a's createdAt but before a's lastActivity -> a is fresh.
    const fresh = freshSongs(songs, "2026-06-05T00:00:00Z");
    expect(fresh.map((s) => s.id)).toContain("a");
  });

  it("excludes everything when the baseline is in the future", () => {
    expect(freshSongs(songs, "2027-01-01T00:00:00Z")).toEqual([]);
  });
});
