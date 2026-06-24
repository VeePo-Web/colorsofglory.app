import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useGlobalCapture } from "@/hooks/useGlobalCapture";
import GlobalCaptureFab from "./GlobalCaptureFab";
import CaptureShell from "./CaptureShell";
import SeedReviewSheet from "./SeedReviewSheet";
import OutboxSyncPill from "@/components/voice/OutboxSyncPill";
import type { SeedIdeaRecord } from "@/lib/voice/seedIdeaApi";

const HIDDEN_ROUTE_PREFIXES = [
  "/auth",
  "/onboarding",
  "/invite",
  "/join",
  "/checkout",
  "/settings",
  "/admin",
  "/r/",
];

const HIDDEN_ROUTE_EXACT = new Set(["/upgrade", "/pricing", "/upgrade-old"]);

function shouldHideGlobalCapture(path: string): boolean {
  return (
    HIDDEN_ROUTE_EXACT.has(path) ||
    HIDDEN_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`))
  );
}

function openMicSettings(): void {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) window.location.href = "app-settings:";
  else if (/Android/.test(ua)) alert("Settings → Apps → Colors of Glory → Permissions → Microphone");
  else alert("Click the 🔒 lock icon in your address bar → Site Settings → Microphone → Allow");
}

function defaultIdeaName(): string {
  const stamp = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Idea — ${stamp}`;
}

/**
 * GlobalCaptureFlow — mounts the persistent capture FAB and its recording/review
 * sheets at the app root. Lives inside <BrowserRouter> so it can read the route
 * and stay out of the way on screens that already own dedicated capture UI
 * (the Song Canvas and its Voice layer).
 */
const GlobalCaptureFlow = () => {
  const location = useLocation();
  const { phase, durationMs, analyserNode, error, pendingRecording, toggle, discard } = useGlobalCapture();

  const handleSaved = useCallback((_record: SeedIdeaRecord) => {
    discard();
  }, [discard]);

  const path = location.pathname;
  // One obvious record action per screen (CapCut/Apple). The BottomNav already
  // carries a raised capture mic on every top-level screen, and song screens have
  // their own contextual mic — so the floating FAB is redundant everywhere and is
  // effectively retired. Hide it on: capture home (`/`), the catalog (`/songs`),
  // every song screen (`/songs/:id…`), the canvas, the Voice layer, and Capture.
  const isCaptureHome = path === "/";
  const isCatalog = path === "/songs";
  const isSongScreen = path.startsWith("/songs/");
  const ownsItsOwnCapture =
    isCaptureHome ||
    isCatalog ||
    isSongScreen ||
    path.includes("/canvas") ||
    path.endsWith("/voice") ||
    path.endsWith("/capture");
  const showFabAndSheets = !(ownsItsOwnCapture || shouldHideGlobalCapture(path));

  const showCaptureShell =
    showFabAndSheets &&
    !pendingRecording &&
    (phase === "recording" ||
      phase === "requesting-permission" ||
      phase === "stopping" ||
      phase === "permission-denied");

  return (
    <>
      {/* App-wide reassurance that no captured take is stranded. Fixed, calm, and
          non-interactive — it never blocks a tap and self-hides when nothing is
          syncing, so it can safely ride on top of every screen (the FAB/sheets
          below stay route-gated). */}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 10px)",
          left: 0,
          right: 0,
          zIndex: 60,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <OutboxSyncPill />
      </div>

      {showFabAndSheets && <GlobalCaptureFab phase={phase} onToggle={toggle} />}

      {showCaptureShell && (
        <CaptureShell
          phase={phase}
          durationMs={durationMs}
          analyserNode={analyserNode}
          error={error}
          onStop={toggle}
          onCancel={discard}
          onOpenSettings={openMicSettings}
        />
      )}

      {showFabAndSheets && pendingRecording && (
        <SeedReviewSheet
          recording={pendingRecording}
          defaultName={defaultIdeaName()}
          onSaved={handleSaved}
          onDiscard={discard}
        />
      )}
    </>
  );
};

export default GlobalCaptureFlow;
