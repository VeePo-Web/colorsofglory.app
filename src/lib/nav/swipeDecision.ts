/**
 * swipeDecision — the pure "did this gesture commit a page turn?" logic,
 * extracted from useSwipeNav so it can be stress-tested without a DOM.
 *
 * The hook owns the touch plumbing (listeners, transforms, rAF); this owns
 * the decision. Keeping them apart means the commit rules — distance,
 * velocity/flick, axis dominance, destination existence — are verified by
 * unit tests, which is how the flick-window regression (pass 21) would have
 * been caught before shipping.
 */

export const SWIPE = {
  EDGE_GUARD_PX: 44,   // leave the screen edges to iOS Safari's own back/forward swipe
  INTENT_PX: 14,       // horizontal travel before the drag "locks" and starts tracking
  TRIGGER_PX: 64,      // horizontal travel required to commit on a slow drag
  MIN_FLICK_PX: 24,    // a fast flick still needs this much travel (vs a tap jitter)
  FLICK_VELOCITY: 0.4, // px/ms at release that commits a short quick flick (~native)
  AXIS_RATIO: 1.6,     // horizontal must dominate vertical by this factor
  RESIST: 0.22,        // damping when dragging toward a direction with no destination
} as const;

export interface SwipeEnd {
  /** Net horizontal travel at release (px). Positive = finger moved right. */
  dx: number;
  /** Net vertical travel at release (px). */
  dy: number;
  /** Release velocity over the last ~100ms (px/ms). Sign = direction. */
  velocity: number;
  /** A destination exists to the LEFT (finger moves left to reach it). */
  hasLeft: boolean;
  /** A destination exists to the RIGHT (finger moves right to reach it). */
  hasRight: boolean;
}

/**
 * Decide which way (if any) a released drag pages. Returns the committed
 * direction or null. "right" means the finger moved right → reveal the
 * surface on the LEFT; "left" means the reverse.
 */
export function decideSwipe(e: SwipeEnd): "left" | "right" | null {
  const adx = Math.abs(e.dx);
  // Horizontal intent must dominate vertical, or it was a scroll.
  if (adx < Math.abs(e.dy) * SWIPE.AXIS_RATIO) return null;

  const farEnough = adx >= SWIPE.TRIGGER_PX;
  const flicked =
    adx >= SWIPE.MIN_FLICK_PX &&
    Math.abs(e.velocity) >= SWIPE.FLICK_VELOCITY &&
    Math.sign(e.velocity) === Math.sign(e.dx);
  if (!(farEnough || flicked)) return null;

  const dir = e.dx > 0 ? "right" : "left";
  const hasDest = dir === "right" ? e.hasRight : e.hasLeft;
  return hasDest ? dir : null;
}
