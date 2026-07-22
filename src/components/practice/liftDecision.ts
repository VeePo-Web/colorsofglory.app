/**
 * liftDecision — the pure "did this vertical drag commit?" logic, the
 * mirror of src/lib/nav/swipeDecision.ts so the vertical and horizontal
 * gestures are ONE family with ONE feel (the Snapchat discipline).
 *
 * Same tuned constants as SWIPE wherever the meaning matches: intent lock,
 * commit distance, the flick's minimum-travel + sign-match guards (a
 * jittery tap must never commit on velocity alone), axis dominance, and
 * the damping for unarmed directions.
 */

export const LIFT = {
  INTENT_PX: 14,       // vertical travel before the drag locks (family value)
  TRIGGER_PX: 64,      // travel required to commit on a slow drag
  MIN_FLICK_PX: 24,    // a fast flick still needs this much travel
  FLICK_VELOCITY: 0.4, // px/ms at release that commits a short quick flick
  AXIS_RATIO: 1.6,     // vertical must dominate horizontal by this factor
  RESIST: 0.22,        // damping toward a direction with no destination
  MAX_TRACK_PX: 120,   // visual travel cap for a handle-sized target
} as const;

export interface LiftEnd {
  /** Net vertical travel at release (px). Positive = finger moved down. */
  dy: number;
  /** Net horizontal travel at release (px). */
  dx: number;
  /** Release velocity over the last ~100ms (px/ms). Sign = direction. */
  velocity: number;
  /** An UP destination exists (the lift). */
  hasUp: boolean;
  /** A DOWN destination exists (the set-down). */
  hasDown: boolean;
}

/** Returns the committed direction or null. "up" = finger moved up. */
export function decideLift(e: LiftEnd): "up" | "down" | null {
  const ady = Math.abs(e.dy);
  // Vertical intent must dominate horizontal, or it was a lateral gesture.
  if (ady < Math.abs(e.dx) * LIFT.AXIS_RATIO) return null;

  const farEnough = ady >= LIFT.TRIGGER_PX;
  const flicked =
    ady >= LIFT.MIN_FLICK_PX &&
    Math.abs(e.velocity) >= LIFT.FLICK_VELOCITY &&
    Math.sign(e.velocity) === Math.sign(e.dy);
  if (!(farEnough || flicked)) return null;

  const dir = e.dy < 0 ? "up" : "down";
  const hasDest = dir === "up" ? e.hasUp : e.hasDown;
  return hasDest ? dir : null;
}
