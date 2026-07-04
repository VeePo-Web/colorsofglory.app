import { useEffect, useRef, useState } from "react";

/**
 * navDirection — spatial direction for route transitions.
 *
 * The app's main surfaces sit side-by-side in space (Songs ← Capture),
 * and detail surfaces open with depth. Two sources feed the entrance:
 *
 *  1. A one-shot direction the caller declares before a forward tap/swipe
 *     (setNavDirection), consumed once on the destination's mount.
 *  2. A coordinate model that derives the direction from where we *came
 *     from* — so the browser/hardware back button (a POP with no declared
 *     direction) still reverses the motion correctly and the geography
 *     never stops reinforcing itself.
 *
 * Deep links and cold loads (no known previous surface) get "none" — no
 * false motion.
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

/** Spatial coordinate of a surface: x = left/right lane, depth = detail level. */
interface Coord { x: number; depth: number }

function coordFor(pathname: string): Coord {
  if (pathname === "/songs") return { x: -1, depth: 0 };       // library, left of the mic
  if (pathname !== "/songs" && /^\/songs\/[^/]+/.test(pathname)) return { x: 0, depth: 1 }; // a song's surfaces
  return { x: 0, depth: 0 };                                    // Capture (home) and peers
}

/** Direction to animate the arriving surface, from prev → next coordinates. */
function directionBetween(prev: string | null, next: string): NavDirection {
  if (!prev || prev === next) return "none";
  const a = coordFor(prev);
  const b = coordFor(next);
  // Resurfacing from a detail surface (browser/hardware back, iOS edge-back).
  // If the destination sits in a different horizontal lane — e.g. the library,
  // which lives to the LEFT — slide it in from that side so hardware back
  // matches the in-app back (Songs always enters from the left). A pure
  // depth-decrease with no lane change stays a calm fade: there is no clean
  // "from above" entrance to fake.
  if (b.depth < a.depth) {
    if (b.x < a.x) return "left";
    if (b.x > a.x) return "right";
    return "none";
  }
  // Going deeper is handled by the explicit "up" on forward taps; a bare
  // deepening with no declaration stays calm.
  if (b.depth > a.depth) return "up";
  // Same depth → a peer move. Which way did the world slide?
  if (b.x < a.x) return "left";
  if (b.x > a.x) return "right";
  return "none";
}

// The last surface we rendered — updated after each surface mounts, so the
// next mount can derive its direction from it (survives browser back).
let prevPath: string | null = null;

/**
 * useSpatialEntrance — the entrance class for a surface at `pathname`.
 *
 * Prefers an explicitly declared forward direction; otherwise derives it
 * from the previous surface's coordinate, so browser/hardware back
 * animates spatially instead of hard-cutting. Computed once per mount.
 */
export function useSpatialEntrance(pathname: string): string {
  const explicit = useRef<NavDirection | null>(null);
  if (explicit.current === null) explicit.current = consumeNavDirection();

  const [cls] = useState(() => {
    const dir = explicit.current !== "none"
      ? (explicit.current as NavDirection)
      : directionBetween(prevPath, pathname);
    return entranceClass(dir);
  });

  useEffect(() => {
    prevPath = pathname;
  }, [pathname]);

  return cls;
}
