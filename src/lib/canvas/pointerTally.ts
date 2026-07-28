/**
 * pointerTally — a window-level census of fingers currently on the glass.
 *
 * The reverse-order pinch bug: finger 1 lands on the BACKGROUND (viewport
 * starts pan/pinch tracking), finger 2 lands on a CARD — the card's own
 * pointerdown stops propagation and arms a drag, so the room pinch-zooms
 * WHILE the card drags, committing an unintended zoom-drifted move. The
 * card-side gesture already aborts when a second finger arrives AFTER its
 * drag; this census closes the reverse order: a card press that begins while
 * ANY other pointer is already down is pinch intent, never a drag.
 *
 * Capture-phase listeners, wired once at import, so the count is correct
 * before any component handler runs. Window blur clears everything (fingers
 * can vanish without pointerup when the browser loses the session).
 */

const active = new Set<number>();

function drop(e: Event): void {
  active.delete((e as PointerEvent).pointerId);
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (e) => active.add((e as PointerEvent).pointerId), true);
  window.addEventListener("pointerup", drop, true);
  window.addEventListener("pointercancel", drop, true);
  window.addEventListener("blur", () => active.clear());
}

/** How many pointers are down right now (inside a pointerdown handler, this
 *  already INCLUDES the current pointer — capture ran first). */
export function activePointerCount(): number {
  return active.size;
}

/** Test-only: reset between specs. */
export function __resetPointerTallyForTests(): void {
  active.clear();
}
