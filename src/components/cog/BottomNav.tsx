import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Settings } from "lucide-react";
import { setNavDirection } from "@/lib/nav/navDirection";
import { preloadOnIdle } from "@/lib/nav/preloadOnIdle";

interface BottomNavProps {
  /** Override active tab for programmatic control */
  active?: "songs" | "capture" | "settings";
}

/**
 * BottomNav — three-tab main navigation.
 *
 * The center Capture tab rises above the nav bar (Adobe Podcast / iOS Music style)
 * to signal its primary importance. Tapping it opens the dedicated capture
 * experience at /capture rather than triggering an inline sheet.
 */
const BottomNav = ({ active }: BottomNavProps) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Make the tab bar as instant as the swipe: warm all three destinations on
  // idle wherever the nav is shown, so tapping any tab (incl. Settings→Songs or
  // anywhere→Settings, which no page prefetches) lands with no loading frame.
  // The current surface's own chunk is already loaded, so that import is a no-op.
  // Also warm the upgrade page: the BottomNav shows across the library + every
  // Settings/Billing/Storage page — exactly where the upgrade CTAs live — so the
  // FIRST "Upgrade" tap opens instantly instead of downloading its chunk then.
  useEffect(() => {
    preloadOnIdle(
      () => import("@/pages/SongCatalogPage"),
      () => import("@/pages/CapturePage"),
      () => import("@/pages/settings/SettingsPage"),
      () => import("@/pages/pricing/UpgradePage"),
    );
  }, []);

  function isTab(tab: "songs" | "capture" | "settings"): boolean {
    if (active) return active === tab;
    if (tab === "songs") return pathname === "/songs";
    if (tab === "capture") return pathname === "/" || pathname === "/capture";
    if (tab === "settings") return pathname.startsWith("/settings");
    return false;
  }

  const captureActive = isTab("capture");
  const songsActive = isTab("songs");
  const settingsActive = isTab("settings");

  // iOS / Instagram / Twitter pattern: re-tapping the tab you're already on
  // scrolls that surface to the top — the fastest way back up a long library.
  // Only navigates when you're actually going somewhere else.
  const scrollTopOrNavigate = (isActive: boolean, dir: "left" | "right" | null, to: string) => {
    if (isActive) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      return;
    }
    if (dir) setNavDirection(dir);
    navigate(to);
  };

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 500,
        height: 80,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        backgroundColor: "rgba(245,240,232,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(28,26,23,0.08)",
        overflow: "visible", // lets the raised center button protrude
      }}
    >
      {/* ── Songs ── */}
      <button
        type="button"
        onClick={() => scrollTopOrNavigate(songsActive, "left", "/songs")}
        aria-label="Songs"
        aria-current={songsActive ? "page" : undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          minWidth: 64,
          minHeight: 52,
          paddingTop: 8,
          paddingBottom: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
          transition: "transform 150ms",
        }}
        onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.90)"; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = ""; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
        onTouchStart={(e) => { e.currentTarget.style.transform = "scale(0.90)"; }}
        onTouchEnd={(e) => { e.currentTarget.style.transform = ""; }}
        onTouchCancel={(e) => { e.currentTarget.style.transform = ""; }}
      >
        <Home
          size={22}
          strokeWidth={songsActive ? 2.2 : 1.5}
          style={{ color: songsActive ? "var(--cog-gold)" : "var(--cog-muted)", transition: "color 150ms" }}
        />
        <span style={{
          fontFamily: "var(--font-body)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: songsActive ? "var(--cog-gold)" : "var(--cog-muted)",
          transition: "color 150ms",
        }}>
          Songs
        </span>
      </button>

      {/* ── Center Capture button (raised) ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          transform: "translateY(-20px)", // rises above the nav bar
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => scrollTopOrNavigate(captureActive, "right", "/capture")}
          aria-label="Capture idea"
          aria-current={captureActive ? "page" : undefined}
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: captureActive
              ? "linear-gradient(145deg, #C9A84C 0%, #B8953A 55%, #9E7D2E 100%)"
              : "linear-gradient(145deg, #B8953A 0%, #9E7D2E 100%)",
            boxShadow: captureActive
              ? "0 8px 28px rgba(184,149,58,0.55), 0 2px 8px rgba(184,149,58,0.30), 0 0 0 4px rgba(184,149,58,0.12)"
              : "0 6px 20px rgba(184,149,58,0.40), 0 2px 8px rgba(184,149,58,0.20)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 150ms, box-shadow 200ms",
            willChange: "transform",
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.91)"; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = ""; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
          onTouchStart={(e) => { e.currentTarget.style.transform = "scale(0.91)"; }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = ""; }}
          onTouchCancel={(e) => { e.currentTarget.style.transform = ""; }}
        >
          {/* Mic SVG inline — no external dependency for the hero element */}
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255,255,255,0.96)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>

        <span style={{
          fontFamily: "var(--font-body)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: captureActive ? "var(--cog-gold)" : "var(--cog-warm-gray)",
          transition: "color 150ms",
        }}>
          Capture
        </span>
      </div>

      {/* ── Settings ── */}
      <button
        type="button"
        onClick={() => scrollTopOrNavigate(settingsActive, null, "/settings")}
        aria-label="Settings"
        aria-current={settingsActive ? "page" : undefined}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          minWidth: 64,
          minHeight: 52,
          paddingTop: 8,
          paddingBottom: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
        onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.90)"; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = ""; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
        onTouchStart={(e) => { e.currentTarget.style.transform = "scale(0.90)"; }}
        onTouchEnd={(e) => { e.currentTarget.style.transform = ""; }}
        onTouchCancel={(e) => { e.currentTarget.style.transform = ""; }}
      >
        <Settings
          size={22}
          strokeWidth={settingsActive ? 2.2 : 1.5}
          style={{ color: settingsActive ? "var(--cog-gold)" : "var(--cog-muted)", transition: "color 150ms" }}
        />
        <span style={{
          fontFamily: "var(--font-body)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: settingsActive ? "var(--cog-gold)" : "var(--cog-muted)",
          transition: "color 150ms",
        }}>
          Settings
        </span>
      </button>
    </nav>
  );
};

export default BottomNav;
