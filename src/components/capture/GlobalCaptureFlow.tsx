import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useGlobalCapture } from "@/hooks/useGlobalCapture";
import GlobalCaptureFab from "./GlobalCaptureFab";
import CaptureShell from "./CaptureShell";
import SeedReviewSheet from "./SeedReviewSheet";
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
  // Hide on screens that own a dedicated mic so two recorders never fight over
  // the same microphone: the canvas, the Voice layer, and the full Capture
  // screen (/capture and /songs/:id/capture).
  const ownsItsOwnCapture =
    path.includes("/canvas") ||
    path.endsWith("/voice") ||
    path.endsWith("/capture");
  if (ownsItsOwnCapture || shouldHideGlobalCapture(path)) return null;

  const showCaptureShell =
    !pendingRecording &&
    (phase === "recording" ||
      phase === "requesting-permission" ||
      phase === "stopping" ||
      phase === "permission-denied");

  return (
    <>
      <GlobalCaptureFab phase={phase} onToggle={toggle} />

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

      {pendingRecording && (
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
