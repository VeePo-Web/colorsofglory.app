import type { ActivityEvent } from "@/integrations/cog/activity";
import { getCreatorColor } from "@/lib/canvas/creatorColors";

/**
 * D3 collab: pure digest logic for "what changed since you left"
 * (Product 12) and the room's "What changed" card.
 *
 * Turns raw activity rows (IDs + event kinds only — the hard product rule)
 * into a calm, capped list of plain-English lines, grouped so five memo
 * uploads read as one line, not five. No React, no network — unit-testable.
 */

export type RecapEntry = {
  id: string;
  text: string;       // "Sarah added 3 voice memos"
  dotColor: string;   // contributor color — always shown next to the text
  lastAt: string;     // ISO of the newest event in the group
  category: string;   // short context tag: "Voice" | "Canvas" | "People" | "Ideas"
};

/** Upload/transcode lifecycle noise — system events, not human changes. */
const NOISE_KINDS = new Set(["memo_finalized", "memo_transcribed"]);

type Phrase = { one: string; many: (n: number) => string; category: string };

const PHRASES: Record<string, Phrase> = {
  take_committed:      { one: "saved a take to the canvas",   many: (n) => `saved ${n} takes to the canvas`, category: "Voice" },
  capture_created:     { one: "captured a new idea",          many: (n) => `captured ${n} new ideas`,        category: "Ideas" },
  capture_promoted:    { one: "promoted an idea",             many: (n) => `promoted ${n} ideas`,            category: "Ideas" },
  memo_uploaded:       { one: "added a voice memo",           many: (n) => `added ${n} voice memos`,         category: "Voice" },
  invite_accepted:     { one: "joined the song",              many: () => "joined the song",                 category: "People" },
  member_left:         { one: "left the song",                many: () => "left the song",                   category: "People" },
  owner_transferred:   { one: "became the owner",             many: () => "became the owner",                category: "People" },
  card_moved:          { one: "rearranged an idea",           many: (n) => `rearranged ${n} ideas`,          category: "Canvas" },
  card_linked:         { one: "connected two ideas",          many: (n) => `connected ${n} ideas`,           category: "Canvas" },
  card_unlinked:       { one: "unlinked an idea",             many: (n) => `unlinked ${n} ideas`,            category: "Canvas" },
  card_grouped:        { one: "grouped ideas together",       many: () => "grouped ideas together",          category: "Canvas" },
  card_section_set:    { one: "tagged an idea with a section", many: (n) => `tagged ${n} ideas with sections`, category: "Canvas" },
  card_promoted_final: { one: "moved an idea into Final",     many: (n) => `moved ${n} ideas into Final`,    category: "Canvas" },
  card_deleted:        { one: "removed an idea",              many: (n) => `removed ${n} ideas`,             category: "Canvas" },
};

const FALLBACK_PHRASE: Phrase = {
  one: "made a change",
  many: (n) => `made ${n} changes`,
  category: "Canvas",
};

export function humanizeActivity(action: string, count: number): { phrase: string; category: string } {
  const p = PHRASES[action] ?? FALLBACK_PHRASE;
  return { phrase: count > 1 ? p.many(count) : p.one, category: p.category };
}

export type BuildRecapOptions = {
  /** Drop this user's own events — "what changed" means what OTHERS did. */
  excludeUserId?: string | null;
  /** Calm cap — Product 12 says at most ~5 lines. */
  cap?: number;
};

/**
 * Group rows by (actor, kind), newest group first, capped.
 * Actor name/color come pre-resolved on the row; color falls back to the
 * deterministic aurora hash and is never the only signal (name is in the text).
 */
export function buildRecapDigest(
  rows: ActivityEvent[],
  { excludeUserId = null, cap = 5 }: BuildRecapOptions = {},
): RecapEntry[] {
  const groups = new Map<string, { row: ActivityEvent; count: number; lastAt: string }>();

  for (const row of rows) {
    if (excludeUserId && row.actor_user_id === excludeUserId) continue;
    if (NOISE_KINDS.has(row.action)) continue;
    const actorKey = row.actor_user_id ?? row.actor_name ?? "someone";
    const key = `${actorKey}|${row.action}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (row.created_at > existing.lastAt) existing.lastAt = row.created_at;
    } else {
      groups.set(key, { row, count: 1, lastAt: row.created_at });
    }
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[1].lastAt.localeCompare(a[1].lastAt))
    .slice(0, cap)
    .map(([key, { row, count, lastAt }]) => {
      const actorName = row.actor_name?.trim() || "Someone";
      const { phrase, category } = humanizeActivity(row.action, count);
      return {
        id: key,
        text: `${actorName} ${phrase}`,
        dotColor: row.actor_color ?? getCreatorColor(row.actor_user_id ?? actorName).base,
        lastAt,
        category,
      };
    });
}
