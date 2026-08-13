import { describe, it, expect } from "vitest";
import {
  buildBandIndex,
  songMatchesPeople,
  shouldShowPeopleRow,
  peopleFilterLabel,
} from "./bandIndex";

const ME = "me";
const members = [
  { song_id: "s1", user_id: ME, role: "owner" },
  { song_id: "s1", user_id: "craig", role: "collaborator" },
  { song_id: "s1", user_id: "parker", role: "collaborator" },
  { song_id: "s2", user_id: ME, role: "owner" },
  { song_id: "s2", user_id: "craig", role: "collaborator" },
  { song_id: "s3", user_id: ME, role: "collaborator" },
  { song_id: "s3", user_id: "sarah", role: "owner" },
  // duplicate row must not double-count
  { song_id: "s3", user_id: "sarah", role: "owner" },
];
const profiles = [
  { user_id: "craig", display_name: "Craig Bell", first_name: "Craig", avatar_color: "#4D8FD2" },
  { user_id: "parker", display_name: "Parker Hayes", first_name: null, avatar_color: null },
  { user_id: "sarah", display_name: "Sarah Levine", first_name: "Sarah", avatar_color: "#C26A95" },
];

describe("bandIndex — the band emerges from memberships", () => {
  const index = buildBandIndex(members, profiles, ME);

  it("counts each person's songs, excludes me, dedupes rows", () => {
    const byId = new Map(index.people.map((p) => [p.userId, p]));
    expect(byId.get("craig")?.songCount).toBe(2);
    expect(byId.get("parker")?.songCount).toBe(1);
    expect(byId.get("sarah")?.songCount).toBe(1);
    expect(byId.has(ME)).toBe(false);
  });

  it("orders people most-shared first, then alphabetical", () => {
    expect(index.people.map((p) => p.firstName)).toEqual(["Craig", "Parker", "Sarah"]);
  });

  it("falls back to display_name's first word and a hashed color when profile fields are null", () => {
    const parker = index.people.find((p) => p.userId === "parker")!;
    expect(parker.firstName).toBe("Parker");
    expect(parker.avatarColor).toBeTruthy();
    expect(parker.initials).toBe("PH");
  });

  it("AND filter: one person = their songs; two people = songs they SHARE", () => {
    expect(songMatchesPeople("s1", ["craig"], index.membersBySong)).toBe(true);
    expect(songMatchesPeople("s2", ["craig"], index.membersBySong)).toBe(true);
    expect(songMatchesPeople("s3", ["craig"], index.membersBySong)).toBe(false);
    // Craig & Parker together → only s1
    expect(songMatchesPeople("s1", ["craig", "parker"], index.membersBySong)).toBe(true);
    expect(songMatchesPeople("s2", ["craig", "parker"], index.membersBySong)).toBe(false);
    // no selection → everything passes
    expect(songMatchesPeople("s3", [], index.membersBySong)).toBe(true);
    // unknown song never matches an active filter
    expect(songMatchesPeople("ghost", ["craig"], index.membersBySong)).toBe(false);
  });

  it("the face row is calm-gated: hidden for a solo writer", () => {
    expect(shouldShowPeopleRow(index.people)).toBe(true);
    const solo = buildBandIndex(
      [{ song_id: "s1", user_id: ME, role: "owner" }],
      [],
      ME,
    );
    expect(shouldShowPeopleRow(solo.people)).toBe(false);
  });

  it("labels read like a person wrote them", () => {
    const [craig, parker, sarah] = index.people;
    expect(peopleFilterLabel([craig])).toBe("Craig");
    expect(peopleFilterLabel([craig, parker])).toBe("Craig & Parker");
    expect(peopleFilterLabel([craig, parker, sarah])).toBe("Craig, Parker & Sarah");
  });
});
