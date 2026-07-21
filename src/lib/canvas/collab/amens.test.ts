import { describe, it, expect } from "vitest";
import type { CardReactionRow } from "@/integrations/cog/reactions";
import {
  amenSummaries,
  amensAsActivity,
  applyToggle,
  confirmOp,
  effectiveRows,
  EMPTY_AMEN_STATE,
  mergeServerRows,
  type AmenState,
} from "./amens";

const ME = "user-me";
const SARAH = "user-sarah";

const row = (over: Partial<CardReactionRow>): CardReactionRow => ({
  id: over.id ?? `srv-${Math.random().toString(36).slice(2)}`,
  song_id: "song-1",
  card_id: "card-a",
  user_id: SARAH,
  kind: "amen",
  note_text: null,
  created_at: "2026-07-21T10:00:00.000Z",
  ...over,
});

describe("amens — the offline-first toggle model", () => {
  it("a fresh amen is a pending add, visible immediately", () => {
    const s = applyToggle(EMPTY_AMEN_STATE, "card-a", "amen", ME, "2026-07-21T11:00:00.000Z");
    expect(s.unsynced).toHaveLength(1);
    const visible = effectiveRows(s, ME);
    expect(visible).toHaveLength(1);
    expect(visible[0].user_id).toBe(ME);
    expect(visible[0].card_id).toBe("card-a");
  });

  it("tap-again before sync annihilates the add — nothing to flush, nothing shown", () => {
    let s = applyToggle(EMPTY_AMEN_STATE, "card-a", "amen", ME, "t1");
    s = applyToggle(s, "card-a", "amen", ME, "t2");
    expect(s.unsynced).toHaveLength(0);
    expect(effectiveRows(s, ME)).toHaveLength(0);
  });

  it("withdrawing a server-backed amen hides it instantly via a pending remove", () => {
    const mine = row({ id: "srv-1", user_id: ME });
    let s: AmenState = { rows: [mine], unsynced: [] };
    s = applyToggle(s, "card-a", "amen", ME, "t1");
    expect(s.unsynced[0].op).toBe("remove");
    expect(effectiveRows(s, ME)).toHaveLength(0);
    // Re-amen before the remove flushes — the removal cancels, the row returns.
    s = applyToggle(s, "card-a", "amen", ME, "t2");
    expect(s.unsynced).toHaveLength(0);
    expect(effectiveRows(s, ME)).toHaveLength(1);
  });

  it("a pending remove never hides someone ELSE's identical amen", () => {
    const sarahs = row({ id: "srv-2", user_id: SARAH });
    const mine = row({ id: "srv-3", user_id: ME });
    let s: AmenState = { rows: [sarahs, mine], unsynced: [] };
    s = applyToggle(s, "card-a", "amen", ME, "t1");
    const visible = effectiveRows(s, ME);
    expect(visible).toHaveLength(1);
    expect(visible[0].user_id).toBe(SARAH);
  });

  it("mergeServerRows completes confirmed adds and applied removes, keeps the rest pending", () => {
    let s = applyToggle(EMPTY_AMEN_STATE, "card-a", "amen", ME, "t1"); // pending add
    s = applyToggle(s, "card-b", "heart", ME, "t2"); // pending add (unsynced)
    // Server listing shows card-a landed (another flush/device) but not card-b.
    const merged = mergeServerRows(s, [row({ id: "srv-9", user_id: ME, card_id: "card-a" })], ME);
    expect(merged.unsynced).toHaveLength(1);
    expect(merged.unsynced[0].card_id).toBe("card-b");
    // And a remove that the server has applied (row gone) also completes.
    const mine = row({ id: "srv-10", user_id: ME, card_id: "card-c" });
    let s2: AmenState = { rows: [mine], unsynced: [] };
    s2 = applyToggle(s2, "card-c", "amen", ME, "t3"); // pending remove
    const merged2 = mergeServerRows(s2, [], ME);
    expect(merged2.unsynced).toHaveLength(0);
  });

  it("confirmOp reconciles a flushed add (row lands) and remove (row leaves)", () => {
    let s = applyToggle(EMPTY_AMEN_STATE, "card-a", "amen", ME, "t1");
    const addOp = s.unsynced[0];
    const serverRow = row({ id: "srv-4", user_id: ME });
    s = confirmOp(s, addOp, serverRow);
    expect(s.unsynced).toHaveLength(0);
    expect(s.rows).toHaveLength(1);

    s = applyToggle(s, "card-a", "amen", ME, "t2"); // now a pending remove
    const removeOp = s.unsynced[0];
    s = confirmOp(s, removeOp, serverRow);
    expect(s.unsynced).toHaveLength(0);
    expect(s.rows).toHaveLength(0);
  });

  it("MID-FLIGHT RACE: withdrawn while the add flew → the landed row gets a compensating remove", () => {
    let s = applyToggle(EMPTY_AMEN_STATE, "card-a", "amen", ME, "t1");
    const addOp = s.unsynced[0];
    // The flusher sent addOp; before it confirms, the user taps again —
    // applyToggle annihilates the pending add (nothing shown).
    s = applyToggle(s, "card-a", "amen", ME, "t2");
    expect(s.unsynced).toHaveLength(0);
    // The server insert lands anyway. confirmOp must queue the undo, and
    // the row must never flash visible.
    const landed = row({ id: "srv-race", user_id: ME });
    s = confirmOp(s, addOp, landed);
    expect(s.unsynced).toHaveLength(1);
    expect(s.unsynced[0].op).toBe("remove");
    expect(effectiveRows(s, ME)).toHaveLength(0);
  });

  it("MID-FLIGHT RACE: re-amened while the remove flew → a compensating add restores it", () => {
    const mine = row({ id: "srv-5", user_id: ME });
    let s: AmenState = { rows: [mine], unsynced: [] };
    s = applyToggle(s, "card-a", "amen", ME, "t1"); // pending remove
    const removeOp = s.unsynced[0];
    s = applyToggle(s, "card-a", "amen", ME, "t2"); // re-amen cancels it
    expect(s.unsynced).toHaveLength(0);
    // The server delete lands anyway — the amen must survive via a new add.
    s = confirmOp(s, removeOp, mine);
    expect(s.unsynced).toHaveLength(1);
    expect(s.unsynced[0].op).toBe("add");
    expect(effectiveRows(s, ME)).toHaveLength(1);
  });

  it("summaries: counts, mine-set, ≤3 deduped contributor dots, my name resolvable", () => {
    const state: AmenState = {
      rows: [
        row({ id: "1", user_id: SARAH, created_at: "2026-07-21T10:00:00Z" }),
        row({ id: "2", user_id: SARAH, kind: "heart", created_at: "2026-07-21T10:05:00Z" }),
        row({ id: "3", user_id: "user-caleb", created_at: "2026-07-21T10:10:00Z" }),
        row({ id: "4", user_id: "user-ava", created_at: "2026-07-21T10:15:00Z" }),
        row({ id: "5", user_id: ME, created_at: "2026-07-21T10:20:00Z" }),
      ],
      unsynced: [],
    };
    const s = amenSummaries(state, ME, (id) => (id === ME ? "Me" : undefined));
    const card = s.get("card-a")!;
    expect(card.count).toBe(5);
    expect(card.mine.has("amen")).toBe(true);
    // Newest first, capped at 3 — so the oldest (Sarah) yields her dot.
    expect(card.contributors.map((c) => c.id)).toEqual([ME, "user-ava", "user-caleb"]);
    expect(card.contributors[0].name).toBe("Me");
    // Never color-only: every dot carries a name (fallback "Someone").
    expect(card.contributors.every((c) => c.name.length > 0)).toBe(true);
  });

  it("amensAsActivity synthesizes idea_amened rows the recap digest can group", () => {
    const state: AmenState = {
      rows: [row({ id: "1" }), row({ id: "2", card_id: "card-b" })],
      unsynced: [],
    };
    const events = amensAsActivity(state, ME, () => "Sarah");
    expect(events).toHaveLength(2);
    expect(events[0].action).toBe("idea_amened");
    expect(events[0].actor_user_id).toBe(SARAH);
    expect(events[0].actor_name).toBe("Sarah");
    expect(events[0].entity_type).toBe("canvas_card");
    // IDs + kinds only — the hard product rule (no card content in payloads).
    expect(events[0].payload).toEqual({});
  });
});
