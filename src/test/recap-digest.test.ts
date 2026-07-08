import { describe, expect, it } from "vitest";
import { buildRecapDigest, humanizeActivity } from "@/lib/canvas/collab/recapDigest";
import type { ActivityEvent } from "@/integrations/cog/activity";

const row = (overrides: Partial<ActivityEvent>): ActivityEvent => ({
  id: Math.random().toString(36).slice(2),
  created_at: "2026-07-07T10:00:00.000Z",
  action: "memo_uploaded",
  entity_type: "voice_memo",
  entity_id: "m1",
  actor_user_id: "u2",
  actor_name: "Naomi",
  actor_color: "#53AB8B",
  payload: {},
  ...overrides,
});

describe("buildRecapDigest — calm grouped 'what changed' lines", () => {
  it("groups repeated (actor, kind) events into one counted line", () => {
    const entries = buildRecapDigest([
      row({ created_at: "2026-07-07T10:00:00.000Z" }),
      row({ created_at: "2026-07-07T10:01:00.000Z" }),
      row({ created_at: "2026-07-07T10:02:00.000Z" }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe("Naomi added 3 voice memos");
    expect(entries[0].lastAt).toBe("2026-07-07T10:02:00.000Z");
  });

  it("excludes the viewer's own events — 'what changed' means what OTHERS did", () => {
    const entries = buildRecapDigest(
      [row({ actor_user_id: "me" }), row({ actor_user_id: "u2" })],
      { excludeUserId: "me" },
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe("Naomi added a voice memo");
  });

  it("skips upload-lifecycle noise (memo_finalized / memo_transcribed)", () => {
    const entries = buildRecapDigest([
      row({ action: "memo_finalized" }),
      row({ action: "memo_transcribed" }),
    ]);
    expect(entries).toHaveLength(0);
  });

  it("caps at 5 groups, newest group first", () => {
    const kinds = [
      "memo_uploaded",
      "capture_created",
      "card_moved",
      "card_promoted_final",
      "invite_accepted",
      "card_deleted",
      "take_committed",
    ];
    const rows = kinds.map((action, i) =>
      row({ action, created_at: `2026-07-07T10:0${i}:00.000Z` }),
    );
    const entries = buildRecapDigest(rows);
    expect(entries).toHaveLength(5);
    // Newest kind (take_committed at 10:06) leads.
    expect(entries[0].text).toBe("Naomi saved a take to the canvas");
  });

  it("falls back to a generic phrase for unknown kinds and 'Someone' for missing names", () => {
    const entries = buildRecapDigest([
      row({ action: "something_new", actor_name: null, actor_color: null }),
    ]);
    expect(entries[0].text).toBe("Someone made a change");
    // Color falls back deterministically — never empty, name is in the text.
    expect(entries[0].dotColor).toBeTruthy();
  });

  it("uses the pre-resolved actor color when present", () => {
    const entries = buildRecapDigest([row({ actor_color: "#8070C4" })]);
    expect(entries[0].dotColor).toBe("#8070C4");
  });
});

describe("humanizeActivity", () => {
  it("reads as plain English for singular and plural", () => {
    expect(humanizeActivity("card_promoted_final", 1).phrase).toBe("moved an idea into Final");
    expect(humanizeActivity("card_promoted_final", 4).phrase).toBe("moved 4 ideas into Final");
    expect(humanizeActivity("invite_accepted", 1).category).toBe("People");
  });
});
