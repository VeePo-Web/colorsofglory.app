import { describe, expect, it } from "vitest";
import { albumFaces, albumFacesScoped, albumPulse } from "./albumBadges";
import type { BandPerson } from "./bandIndex";
import type { SongPulse } from "./useCatalogPulse";

const person = (userId: string, firstName: string, songCount: number): BandPerson => ({
  userId,
  name: firstName,
  firstName,
  avatarColor: "#B8953A",
  initials: firstName.slice(0, 2).toUpperCase(),
  songCount,
});

const pulse = (unseen: number, line: string | null, at: string | null): SongPulse => ({
  unseen,
  line,
  sentence: line,
  at,
});

describe("albumFaces — who's on this EP, from the shelf", () => {
  // The band's prominence order (most-shared first) — the iteration spine.
  const people = [person("sarah", "Sarah", 5), person("caleb", "Caleb", 3), person("parker", "Parker", 1)];
  const membersBySong = new Map<string, Set<string>>([
    ["s1", new Set(["me", "caleb"])],
    ["s2", new Set(["me", "sarah", "caleb"])],
    ["s3", new Set(["me"])],
  ]);

  it("unions people across the album's songs, no duplicates, prominence order kept", () => {
    const faces = albumFaces(["s1", "s2"], membersBySong, people);
    expect(faces.map((f) => f.userId)).toEqual(["sarah", "caleb"]);
  });

  it("never shows me (the people list already excludes me — membership ids alone don't add faces)", () => {
    const faces = albumFaces(["s3"], membersBySong, people);
    expect(faces).toEqual([]);
  });

  it("empty album, unknown songs, or a solo band → no faces", () => {
    expect(albumFaces([], membersBySong, people)).toEqual([]);
    expect(albumFaces(["ghost"], membersBySong, people)).toEqual([]);
    expect(albumFaces(["s2"], membersBySong, [])).toEqual([]);
  });
});

describe("albumFacesScoped — the in-album face row tells THIS album's truth", () => {
  // Sarah leads the LIBRARY (5 songs) but Caleb leads THIS EP (2 of its 2).
  const people = [person("sarah", "Sarah", 5), person("caleb", "Caleb", 3)];
  const membersBySong = new Map<string, Set<string>>([
    ["s1", new Set(["me", "caleb"])],
    ["s2", new Set(["me", "sarah", "caleb"])],
  ]);

  it("retells every chip count as the album's own, and re-ranks by it", () => {
    const scoped = albumFacesScoped(["s1", "s2"], membersBySong, people);
    expect(scoped.map((p) => [p.userId, p.songCount])).toEqual([
      ["caleb", 2],
      ["sarah", 1],
    ]);
  });

  it("equal local counts fall back to alphabetical — chips never reshuffle arbitrarily", () => {
    const even = new Map<string, Set<string>>([["s2", new Set(["me", "sarah", "caleb"])]]);
    const scoped = albumFacesScoped(["s2"], even, people);
    expect(scoped.map((p) => p.userId)).toEqual(["caleb", "sarah"]);
  });
});

describe("albumPulse — the freshest voice of the album's songs", () => {
  it("sums unseen across songs and speaks with the FRESHEST song's line", () => {
    const bySong = new Map<string, SongPulse>([
      ["s1", pulse(2, "Caleb · 3h ago", "2026-08-16T05:00:00Z")],
      ["s2", pulse(1, "Sarah · 2h ago", "2026-08-16T06:00:00Z")],
    ]);
    expect(albumPulse(["s1", "s2"], bySong)).toEqual({ unseen: 3, line: "Sarah · 2h ago" });
  });

  it("all seen but recent activity → line with unseen 0 (the cover still says who, no dot)", () => {
    const bySong = new Map<string, SongPulse>([["s1", pulse(0, "Sarah · 2h ago", "2026-08-16T06:00:00Z")]]);
    expect(albumPulse(["s1"], bySong)).toEqual({ unseen: 0, line: "Sarah · 2h ago" });
  });

  it("nothing to say → null, so the cover falls back to its plain song count", () => {
    expect(albumPulse(["s1"], new Map())).toBeNull();
    const silent = new Map<string, SongPulse>([["s1", pulse(0, null, null)]]);
    expect(albumPulse(["s1"], silent)).toBeNull();
  });

  it("a malformed timestamp never poisons the pick — the valid line wins", () => {
    const bySong = new Map<string, SongPulse>([
      ["s1", pulse(0, "Ghost · ?", "not-a-date")],
      ["s2", pulse(1, "Sarah · 2h ago", "2026-08-16T06:00:00Z")],
    ]);
    expect(albumPulse(["s1", "s2"], bySong)).toEqual({ unseen: 1, line: "Sarah · 2h ago" });
  });
});
