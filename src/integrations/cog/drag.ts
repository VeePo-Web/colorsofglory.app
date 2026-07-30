/**
 * R54 · Conflict-safe card dragging.
 *
 * Stress test that exposed this: two people drag the same card at once. Before
 * R54 the canvas (a) wrote one `card_moved` activity row per drag — flooding
 * the feed and, after R53, firing a refetch on every nudge — and (b) applied
 * last-write-wins with no timestamp, so a slow request could yank a card back
 * to where it was a second ago, under the other person's finger.
 *
 * Backend now stamps `moved_by` / `moved_at`, ignores a stale move from another
 * user, and logs nothing. This module is the client half:
 *   - `moveCard` sends the CLIENT timestamp taken when the finger lifted, so
 *     ordering follows the gesture, not the network.
 *   - `beginDrag` marks a card locally held: while you hold it, remote
 *     positions for that card are ignored, so it never jumps under your finger.
 *   - Sends are throttled to one write per 200 ms per card, plus one final
 *     write on release, so a two-second drag is ~10 requests, not 120.
 */
import { supabase } from "@/integrations/supabase/client";

const THROTTLE_MS = 200;

type Pending = { x: number; y: number; z?: number; timer: ReturnType<typeof setTimeout> | null; last: number };

const held = new Set<string>();
const pending = new Map<string, Pending>();

/** True while THIS device is dragging the card — remote moves must be ignored. */
export function isHeldLocally(cardId: string): boolean {
  return held.has(cardId);
}

/** Call on pointer-down. */
export function beginDrag(cardId: string): void {
  held.add(cardId);
}

/** Call on pointer-up, AFTER the final `moveCard`. */
export function endDrag(cardId: string): void {
  held.delete(cardId);
}

async function send(cardId: string, x: number, y: number, z?: number): Promise<void> {
  const { error } = await supabase.rpc("canvas_move_card", {
    _card_id: cardId,
    _x: x,
    _y: y,
    _z_index: z ?? null,
    _client_ts: new Date().toISOString(),
  } as never);
  if (error) throw new Error(error.message);
}

/**
 * Persist a card position. Throttled per card; `final` flushes immediately so
 * the last frame of a gesture is always the one that lands.
 */
export function moveCard(
  cardId: string,
  x: number,
  y: number,
  opts: { z?: number; final?: boolean } = {},
): void {
  const entry = pending.get(cardId) ?? { x, y, z: opts.z, timer: null, last: 0 };
  entry.x = x;
  entry.y = y;
  if (opts.z !== undefined) entry.z = opts.z;
  pending.set(cardId, entry);

  const flush = () => {
    entry.timer = null;
    entry.last = Date.now();
    void send(cardId, entry.x, entry.y, entry.z);
  };

  if (opts.final) {
    if (entry.timer) clearTimeout(entry.timer);
    flush();
    pending.delete(cardId);
    return;
  }
  if (entry.timer) return;
  entry.timer = setTimeout(flush, Math.max(0, THROTTLE_MS - (Date.now() - entry.last)));
}