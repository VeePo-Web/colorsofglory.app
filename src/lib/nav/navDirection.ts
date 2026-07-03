/**
 * navDirection — one-shot spatial direction for route transitions.
 *
 * The app's main surfaces sit side-by-side in space (Songs ← Capture),
 * and detail surfaces open with depth. Before navigating, the caller
 * declares which way the world moves; the destination page consumes it
 * once on mount to pick its entrance animation. Falls back to "none"
 * (no motion) for deep links, browser back/forward, and reloads —
 * geography is only animated when we actually know the direction.
 */
export type NavDirection = "left" | "right" | "up" | "none";

let pending: NavDirection = "none";

export function setNavDirection(dir: NavDirection): void {
  pending = dir;
}

/** Read and clear the pending direction (one-shot). */
export function consumeNavDirection(): NavDirection {
  const dir = pending;
  pending = "none";
  return dir;
}

/** Entrance animation class for a surface, given where we came from. */
export function entranceClass(dir: NavDirection): string {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return dir === "none" ? "" : "nav-enter-fade";
  }
  switch (dir) {
    case "left":  return "nav-enter-from-left";
    case "right": return "nav-enter-from-right";
    case "up":    return "nav-enter-from-below";
    default:      return "";
  }
}
