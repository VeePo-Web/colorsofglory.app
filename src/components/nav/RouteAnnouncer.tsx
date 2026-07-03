import { useEffect, useState } from "react";
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
 * RouteAnnouncer — the classic SPA accessibility hole: a visual route change
 * is silent to screen readers. A polite live region names each main surface
 * as it arrives, so the spatial map exists for ears as well as thumbs.
 */
const RouteAnnouncer = () => {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");

  useEffect(() => {
    const name = surfaceName(pathname);
    if (!name) return;
    // Small delay so the announcement lands after the surface renders.
    const t = window.setTimeout(() => setMessage(name), 80);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return (
    <div
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
      }}
    >
      {message}
    </div>
  );
};

export default RouteAnnouncer;
