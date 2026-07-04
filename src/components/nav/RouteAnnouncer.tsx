import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/** Human name for each surface — spoken, so plain words, never jargon. */
const surfaceName = (pathname: string): string | null => {
  if (pathname === "/" || pathname === "/capture") return "Capture";
  if (pathname === "/songs") return "Your songs";
  if (pathname === "/memory") return "Your memory";
  if (pathname.startsWith("/settings")) return "Settings";
  const song = pathname.match(/^\/songs\/[^/]+(?:\/([^/]+))?$/);
  if (song) {
    switch (song[1]) {
      case undefined:
      case "capture":
      case "brainstorm": return "Song capture";
      case "room":       return "Song room";
      case "sheet":      return "Lyric sheet";
      case "canvas":     return "Song canvas";
      case "practice":   return "Practice player";
      case "memory":     return "Song memory";
      default:           return null;
    }
  }
  return null;
};

/**
 * RouteAnnouncer — closes the two classic SPA accessibility holes at once:
 *
 *  1. A visual route change is silent to screen readers → a polite live
 *     region names each main surface as it arrives, so the spatial map
 *     exists for ears as well as thumbs.
 *  2. Keyboard / switch focus is stranded on a now-unmounted control after
 *     navigation → focus is moved to a top-of-surface sentinel so the next
 *     Tab starts inside the new surface, not wherever the old button was.
 *     preventScroll keeps the reset invisible; only real surface changes
 *     (not in-place param tweaks) reset focus, so it never fights typing.
 */
const RouteAnnouncer = () => {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const focusRef = useRef<HTMLDivElement>(null);
  const lastSurface = useRef<string | null>(null);

  useEffect(() => {
    const name = surfaceName(pathname);
    if (!name) return;

    // Announce after the surface renders.
    const t = window.setTimeout(() => setMessage(name), 80);

    // Reset focus only when the surface actually changes — reopening the
    // same surface with different params must never yank focus mid-task.
    if (name !== lastSurface.current) {
      lastSurface.current = name;
      const f = window.setTimeout(() => {
        focusRef.current?.focus({ preventScroll: true });
      }, 90);
      return () => {
        window.clearTimeout(t);
        window.clearTimeout(f);
      };
    }
    return () => window.clearTimeout(t);
  }, [pathname]);

  return (
    <div
      ref={focusRef}
      tabIndex={-1}
      aria-live="polite"
      role="status"
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: "hidden",
        clip: "rect(0 0 0 0)",
        whiteSpace: "nowrap",
        border: 0,
        outline: "none",
      }}
    >
      {message}
    </div>
  );
};

export default RouteAnnouncer;
