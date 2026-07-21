import type { ActivityEvent } from "@/integrations/cog/activity";
import type { CardReactionKind, CardReactionRow } from "@/integrations/cog/reactions";
import { getCreatorColor } from "@/lib/canvas/creatorColors";

/**
 * Amens — pure logic for the canvas encouragement layer.
 *
 * The model that makes offline-first painless: the SERVER is the truth for
 * everyone else's amens; THIS DEVICE's op queue is the truth for mine. An
 * unsynced add shows instantly; an add followed by a remove cancels to
 * nothing (no tombstones); a flush replays the queue best-effort and the
 * realtime/list path reconciles. No React, no network in this file.
 */

export type AmenOp = {
  op: "add" | "remove";
  card_id: string;
  kind: CardReactionKind;
  created_at: string;
};

export type AmenState = {
  /** Last-known server rows (mine + others), persisted for offline reloads. */
  rows: CardReactionRow[];
  /** My not-yet-confirmed toggles, replayed in order by the flusher. */
  unsynced: AmenOp[];
};

export const EMPTY_AMEN_STATE: AmenState = { rows: [], unsynced: [] };

/** One card's warm cluster, ready to render. */
export type AmenSummary = {
  count: number;
  /** Did I amen this card (any kind)? Drives the gold "yours" state. */
  mine: Set<CardReactionKind>;
  /** Up to 3 contributor dots, newest first — color + name, never color alone. */
  contributors: Array<{ id: string; name: string; color: string }>;
  latestAt: string;
};

const key = (cardId: string, kind: string) => `${cardId}|${kind}`;

/**
 * The rows this device believes exist right now: server rows, minus my rows
 * that have a pending remove, plus my pending adds (as synthetic rows).
 */
export function effectiveRows(state: AmenState, myId: string): CardReactionRow[] {
  const pendingRemoves = new Set(
    state.unsynced.filter((o) => o.op === "remove").map((o) => key(o.card_id, o.kind)),
  );
  const out = state.rows.filter(
    (r) => !(r.user_id === myId && pendingRemoves.has(key(r.card_id, r.kind))),
  );
  for (const o of state.unsynced) {
    if (o.op !== "add") continue;
    out.push({
      id: `local:${key(o.card_id, o.kind)}`,
      song_id: "",
      card_id: o.card_id,
      user_id: myId,
      kind: o.kind,
      note_text: null,
      created_at: o.created_at,
    });
  }
  return out;
}

/**
 * Toggle my (card, kind). Pure — returns the next state. A pending add
 * cancels in place; a server-backed amen gains a pending remove; otherwise a
 * pending add is enqueued. `now` injected for testability.
 */
export function applyToggle(
  state: AmenState,
  cardId: string,
  kind: CardReactionKind,
  myId: string,
  now: string,
): AmenState {
  const k = key(cardId, kind);
  const pendingAdd = state.unsynced.find((o) => o.op === "add" && key(o.card_id, o.kind) === k);
  if (pendingAdd) {
    // Never reached the server — the two ops annihilate.
    return { ...state, unsynced: state.unsynced.filter((o) => o !== pendingAdd) };
  }
  const pendingRemove = state.unsynced.find(
    (o) => o.op === "remove" && key(o.card_id, o.kind) === k,
  );
  if (pendingRemove) {
    // Re-amen before the remove flushed — cancel the removal, row returns.
    return { ...state, unsynced: state.unsynced.filter((o) => o !== pendingRemove) };
  }
  const onServer = state.rows.some(
    (r) => r.user_id === myId && r.card_id === cardId && r.kind === kind,
  );
  const op: AmenOp = { op: onServer ? "remove" : "add", card_id: cardId, kind, created_at: now };
  return { ...state, unsynced: [...state.unsynced, op] };
}

/**
 * Fold a fresh server listing in. Ops stay pending (the flusher owns them) —
 * except adds the server now confirms and removes the server has applied,
 * which are complete and drop out of the queue.
 */
export function mergeServerRows(state: AmenState, rows: CardReactionRow[], myId: string): AmenState {
  const mineOnServer = new Set(
    rows.filter((r) => r.user_id === myId).map((r) => key(r.card_id, r.kind)),
  );
  const unsynced = state.unsynced.filter((o) =>
    o.op === "add" ? !mineOnServer.has(key(o.card_id, o.kind)) : mineOnServer.has(key(o.card_id, o.kind)),
  );
  return { rows, unsynced };
}

/**
 * A confirmed single add/remove (flusher success) — reconcile locally.
 *
 * The mid-flight race: if the user toggled AGAIN while this op was on the
 * wire, applyToggle annihilated it from the queue — but the server change
 * still landed. The op's absence from `unsynced` is the tell: queue the
 * compensating op so the server ends where the user's last tap left it.
 */
export function confirmOp(state: AmenState, op: AmenOp, row: CardReactionRow | null): AmenState {
  const k = key(op.card_id, op.kind);
  const wasPending = state.unsynced.includes(op);
  const unsynced = state.unsynced.filter((o) => o !== op);
  if (op.op === "add" && row) {
    if (!wasPending) {
      // Withdrawn while the add flew — undo the landed row, show nothing.
      return {
        rows: state.rows,
        unsynced: [
          ...unsynced,
          { op: "remove", card_id: op.card_id, kind: op.kind, created_at: row.created_at },
        ],
      };
    }
    const rows = state.rows.some((r) => r.id === row.id) ? state.rows : [...state.rows, row];
    return { rows, unsynced };
  }
  if (op.op === "remove") {
    const rows = state.rows.filter(
      (r) => !(r.user_id === row?.user_id && key(r.card_id, r.kind) === k),
    );
    if (!wasPending) {
      // Re-amened while the remove flew — put it back on the server.
      return {
        rows,
        unsynced: [
          ...unsynced,
          { op: "add", card_id: op.card_id, kind: op.kind, created_at: op.created_at },
        ],
      };
    }
    return { rows, unsynced };
  }
  return { ...state, unsynced };
}

export type AmenNameResolver = (userId: string) => string | undefined;

/** Group the effective rows per card into render-ready clusters. */
export function amenSummaries(
  state: AmenState,
  myId: string,
  resolveName?: AmenNameResolver,
): Map<string, AmenSummary> {
  const out = new Map<string, AmenSummary>();
  const rows = [...effectiveRows(state, myId)].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  for (const r of rows) {
    let s = out.get(r.card_id);
    if (!s) {
      s = { count: 0, mine: new Set(), contributors: [], latestAt: r.created_at };
      out.set(r.card_id, s);
    }
    s.count += 1;
    if (r.created_at > s.latestAt) s.latestAt = r.created_at;
    if (r.user_id === myId) s.mine.add(r.kind);
    if (s.contributors.length < 3 && !s.contributors.some((c) => c.id === r.user_id)) {
      s.contributors.push({
        id: r.user_id,
        name: resolveName?.(r.user_id) ?? "Someone",
        color: getCreatorColor(r.user_id).base,
      });
    }
  }
  return out;
}

/**
 * Others' amens as synthetic activity rows so the "what changed" recap can
 * fold them in ("Sarah left 3 amens") without a backend activity writer.
 * My own are excluded by the digest's excludeUserId — passed through anyway
 * for symmetry.
 */
export function amensAsActivity(
  state: AmenState,
  myId: string,
  resolveName?: AmenNameResolver,
): ActivityEvent[] {
  return effectiveRows(state, myId).map((r) => ({
    id: `amen:${r.id}`,
    created_at: r.created_at,
    action: "idea_amened",
    entity_type: "canvas_card",
    entity_id: r.card_id,
    actor_user_id: r.user_id,
    actor_name: resolveName?.(r.user_id) ?? null,
    actor_color: getCreatorColor(r.user_id).base,
    payload: {},
  }));
}

// ── Device persistence (offline reloads keep the warmth) ──────────────────

const STORE_KEY = (songId: string) => `cog:amens-${songId}`;
const MAX_PERSISTED_ROWS = 500;

export function readAmenState(songId: string): AmenState {
  try {
    const raw = localStorage.getItem(STORE_KEY(songId));
    if (!raw) return EMPTY_AMEN_STATE;
    const parsed = JSON.parse(raw) as Partial<AmenState>;
    return {
      rows: Array.isArray(parsed.rows) ? parsed.rows : [],
      unsynced: Array.isArray(parsed.unsynced) ? parsed.unsynced : [],
    };
  } catch {
    return EMPTY_AMEN_STATE;
  }
}

export function writeAmenState(songId: string, state: AmenState): void {
  try {
    localStorage.setItem(
      STORE_KEY(songId),
      JSON.stringify({ rows: state.rows.slice(-MAX_PERSISTED_ROWS), unsynced: state.unsynced }),
    );
  } catch {
    /* storage full/unavailable — in-memory state still serves the session */
  }
}

/** Stable device actor id for demo rooms / signed-out local mode. */
export function deviceActorId(): string {
  const KEY = "cog:device-actor-id";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `device-${crypto.randomUUID()}`
        : `device-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return "device-local";
  }
}
