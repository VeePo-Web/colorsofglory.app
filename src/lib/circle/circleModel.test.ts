import { describe, it, expect } from "vitest";
import type { ActivityEvent } from "@/integrations/cog/activity";
import {
  buildCircleDigest,
  buildCirclePeople,
  countRecentAmens,
  CIRCLE_MAX_LINES,
  CIRCLE_MAX_PEOPLE,
} from "./circleModel";

const ME = "user-me";

const ev = (over: Partial<ActivityEvent>): ActivityEvent => ({
  id: `e-${Math.random().toString(36).slice(2)}`,
  created_at: "2026-07-22T10:00:00Z",
  action: "memo_uploaded",
  entity_type: "voice_memo",
  entity_id: null,
  actor_user_id: "user-sarah",
  actor_name: "Sarah",
  actor_color: null,
  payload: {},
  ...over,
});

describe("circle — the hearth's aggregation (real, finite, fenced)", () => {
  it("groups a burst into ONE warm line — never one line per event", () => {
    const lines = buildCircleDigest(
      [
        {
          songId: "s1",
          songTitle: "Grace in the Waiting",
          events: [ev({}), ev({}), ev({ created_at: "2026-07-22T11:00:00Z" })],
        },
      ],
      ME,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("Sarah added 3 voice memos");
    expect(lines[0].songTitle).toBe("Grace in the Waiting");
    expect(lines[0].lastAt).toBe("2026-07-22T11:00:00Z");
  });

  it("your own work never appears — 'what changed' means what OTHERS did", () => {
    const lines = buildCircleDigest(
      [{ songId: "s1", songTitle: "T", events: [ev({ actor_user_id: ME, actor_name: "Me" })] }],
      ME,
    );
    expect(lines).toHaveLength(0);
  });

  it("finite by construction: capped, newest first, across songs", () => {
    const perSong = Array.from({ length: 5 }, (_, s) => ({
      songId: `s${s}`,
      songTitle: `Song ${s}`,
      events: Array.from({ length: 3 }, (_, a) =>
        ev({
          actor_user_id: `user-${s}-${a}`,
          actor_name: `Person ${s}${a}`,
          created_at: `2026-07-${String(10 + s).padStart(2, "0")}T0${a}:00:00Z`,
        }),
      ),
    }));
    const lines = buildCircleDigest(perSong, ME);
    expect(lines).toHaveLength(CIRCLE_MAX_LINES);
    // Newest first — the most recent song's events lead.
    expect(lines[0].lastAt >= lines[lines.length - 1].lastAt).toBe(true);
  });

  it("people are deduped across songs and carry the shared titles, not counts", () => {
    const people = buildCirclePeople(
      [
        { userId: "u1", name: "Sarah Miller", songId: "s1", songTitle: "Alpha" },
        { userId: "u1", name: "Sarah Miller", songId: "s2", songTitle: "Beta" },
        { userId: "u2", name: "Caleb", songId: "s1", songTitle: "Alpha" },
        { userId: ME, name: "Me", songId: "s1", songTitle: "Alpha" },
      ],
      ME,
    );
    expect(people).toHaveLength(2); // me excluded, Sarah deduped
    const sarah = people.find((p) => p.id === "u1")!;
    expect(sarah.sharedTitles).toEqual(["Alpha", "Beta"]);
    expect(sarah.initials.length).toBeGreaterThan(0);
  });

  it("people cap holds", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      userId: `u${i}`,
      name: `P ${i}`,
      songId: "s1",
      songTitle: "Alpha",
    }));
    expect(buildCirclePeople(many, ME)).toHaveLength(CIRCLE_MAX_PEOPLE);
  });

  it("amens count only others', only since the anchor", () => {
    const { total, songTitles } = countRecentAmens(
      [
        {
          songTitle: "Alpha",
          rows: [
            { user_id: "u1", created_at: "2026-07-22T10:00:00Z" }, // fresh, other
            { user_id: ME, created_at: "2026-07-22T10:00:00Z" }, // mine — excluded
            { user_id: "u2", created_at: "2026-07-01T10:00:00Z" }, // stale
          ],
        },
      ],
      ME,
      "2026-07-20T00:00:00Z",
    );
    expect(total).toBe(1);
    expect(songTitles).toEqual(["Alpha"]);
  });
});
