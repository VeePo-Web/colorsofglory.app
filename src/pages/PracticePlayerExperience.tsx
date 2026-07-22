import { useEffect, useCallback, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Loader2, Mic } from "lucide-react";
import { goBackOr } from "@/lib/nav/safeBack";
import { usePracticeContext } from "@/hooks/usePracticeContext";
import { DriveModePlayer } from "@/components/practice/DriveModePlayer";
import { FlowPlayer } from "@/components/practice/FlowPlayer";
import { FullPracticePlayer } from "@/components/practice/FullPracticePlayer";
import { useLiftGesture } from "@/components/practice/useLiftGesture";
import { loadSession, loadLoopMode } from "@/lib/audio/practiceStorage";
import { loadPracticeBundle } from "@/lib/practice/practiceApi";
import type { PracticeSection } from "@/lib/audio/practiceTypes";

/**
 * The set-down grabber — the top-center pull-down that returns you exactly
 * where you were (the mirror of the Flow handle's lift). Anchored to
 * itself, so it never fights the player's own content or Flow's autoscroll;
 * also a plain tappable button (the non-gesture path). `visualTarget` is
 * the page wrapper, so the WHOLE surface rides the finger down — the
 * Apple-Music sheet dismissal, not a lone pill sliding.
 */
function SetDownGrabber({
  onDismiss,
  visualTarget,
}: {
  onDismiss: () => void;
  visualTarget?: React.RefObject<HTMLElement>;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useLiftGesture(ref, { onPullDown: onDismiss, visualTarget });
  return (
    <button
      ref={ref}
      type="button"
      onClick={onDismiss}
      aria-label="Set the song down — back to where you were"
      className="fixed left-1/2 z-50 flex items-center justify-center"
      style={{
        top: 0,
        transform: "translateX(-50%)",
        paddingTop: "calc(env(safe-area-inset-top) + 6px)",
        paddingBottom: 10,
        paddingInline: 28,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        minHeight: 44,
        minWidth: 64,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 5,
          borderRadius: 999,
          backgroundColor: "rgba(28,26,23,0.22)",
        }}
      />
    </button>
  );
}

/**
 * Keep the screen awake while a practice session is live on this route — a
 * music stand that sleeps mid-verse fails the one job it has. Best-effort
 * (Wake Lock API where available); reacquires when the tab returns.
 */
function usePracticeWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    if (!nav.wakeLock) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        sentinel = await nav.wakeLock!.request("screen");
        if (cancelled) void sentinel.release().catch(() => {});
      } catch {
        /* denied (low battery etc.) — never block practice */
      }
    };

    void acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}

/**
 * Route: /song/:songId/practice
 *
 * Responsible for:
 * - Reading route params + canvas section/memo data from navigation state
 * - Calling hook.initSession() to start pre-caching
 * - Rendering DriveModePlayer OR FullPracticePlayer depending on driveMode flag
 */
export default function PracticePlayerPage() {
  const { songId } = useParams<{ songId: string }>();
  const navigate   = useNavigate();
  const location   = useLocation();
  const hook       = usePracticeContext();
  const { state, initSession, applyEnrichment } = hook;
  // Flow — the hands-free autoscroll perform mode (self-paced, no playback).
  // The Flow handle lifts straight here with { flow: true } in nav state
  // (docs/FLOW-ACCESS-CONTRACT.md) — arriving in perform mode, one gesture.
  const [flowMode, setFlowMode] = useState(
    () => Boolean((location.state as { flow?: boolean } | null)?.flow),
  );
  // The set-down drag's visual target — the whole page rides the finger.
  const dismissRef = useRef<HTMLDivElement>(null);

  // Screen stays awake for the whole live session (full player, drive mode,
  // and Flow — a music stand that sleeps mid-verse fails its one job).
  usePracticeWakeLock(
    flowMode ||
    (state.songId === songId &&
      (state.status === "ready" || state.status === "playing" || state.status === "paused")),
  );

  // Practice launches from the canvas; closing pops back there, but on a cold
  // load / deep link it lands on the song's canvas instead of dead-ending.
  const handleClose = useCallback(() => {
    goBackOr(navigate, location.key, songId ? `/songs/${songId}/canvas` : "/songs");
  }, [navigate, location.key, songId]);

  // Init on mount — sections come from navigation state or we derive from route
  useEffect(() => {
    if (!songId) return;
    // Re-expanded from the mini-player while this song is already live — keep
    // the running session instead of resetting its stats and position.
    if (state.songId === songId && state.status !== "idle") return;

    let cancelled = false;

    (async () => {
      // Navigation state injected by SongCanvasExperience (or the Resume card).
      const navState = (window.history.state?.usr ?? {}) as {
        songTitle?: string;
        sections?: PracticeSection[];
      };

      const persisted = loadSession(songId);
      const title = navState.songTitle ?? persisted?.title ?? "Untitled Song";

      const savedMode = loadLoopMode(songId);

      if (navState.sections) {
        // Canvas fast path: start instantly on the nav-state sections, then
        // enrich in the background with the full bundle — takes per section
        // (F15), the chord chart (C3), and the song's tempo/key — without
        // disturbing whatever is already playing.
        if (savedMode) hook.setLoopMode(savedMode);
        initSession(songId, title, navState.sections, persisted ?? undefined);
        try {
          const bundle = await loadPracticeBundle(songId);
          if (!cancelled) {
            applyEnrichment(songId, bundle.sections, { bpm: bundle.bpm, songKey: bundle.songKey });
          }
        } catch { /* enrichment is best-effort — practice already runs */ }
        return;
      }

      // Deep-link / resume-from-home has no sections in nav state — self-load
      // so practice never dead-ends when opened cold.
      const bundle = await loadPracticeBundle(songId);
      if (cancelled) return;

      if (savedMode) hook.setLoopMode(savedMode);

      initSession(songId, title, bundle.sections, persisted ?? undefined, {
        bpm: bundle.bpm,
        songKey: bundle.songKey,
      });
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  // Idle / no sections — warm, points at the one action that unlocks practice
  if (state.status === "idle") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center"
        style={{ backgroundColor: "var(--cog-cream)" }}
      >
        <div className="pointer-events-none absolute inset-0 cog-glow" />
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{ width: 64, height: 64, backgroundColor: "rgba(184,149,58,0.12)" }}
        >
          <Mic size={26} style={{ color: "var(--cog-gold)" }} />
        </div>
        <p
          className="relative"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", fontWeight: 600, color: "var(--cog-charcoal)" }}
        >
          Record a take to practice this song
        </p>
        <p
          className="relative"
          style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--cog-warm-gray)", maxWidth: 300 }}
        >
          Once a section has a voice memo, it shows up here ready to loop, slow down, and rehearse.
        </p>
        <button
          onClick={handleClose}
          className="relative rounded-full px-6 py-2.5 mt-2 active:scale-[0.97]"
          style={{
            backgroundColor: "var(--cog-gold)",
            color: "#fff",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            border: "none",
            minHeight: 44,
          }}
        >
          Back to the song
        </button>
      </div>
    );
  }

  // Initial caching phase — show full-screen loader
  if (state.status === "caching" && state.sections.every(s => s.cacheStatus === "pending")) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: "var(--cog-cream)" }}
      >
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--cog-gold)" }} />
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--cog-warm-gray)" }}>
          Preparing your song for practice…
        </p>
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--cog-muted)" }}>
          Audio is cached so it works offline
        </p>
      </div>
    );
  }

  // ─── Flow — hands-free autoscroll perform mode ──────────────────────────
  // The dismissal wrapper: fixed inset-0 with no transform at rest, so the
  // players' own fixed layouts are untouched — the moment the set-down drag
  // applies a transform, the wrapper becomes their containing block at the
  // exact same geometry, and the WHOLE surface rides the finger down.
  if (flowMode) {
    return (
      <div ref={dismissRef} style={{ position: "fixed", inset: 0 }}>
        <SetDownGrabber onDismiss={handleClose} visualTarget={dismissRef} />
        <FlowPlayer hook={hook} onExit={() => setFlowMode(false)} />
      </div>
    );
  }

  // ─── Drive Mode — separate render tree ─────────────────────────────────
  // Deliberately NO set-down grabber: a small top target is a mis-tap
  // hazard for a driver; Drive Mode keeps its own big exit.
  if (state.driveMode) {
    return <DriveModePlayer hook={hook} />;
  }

  // ─── Normal full-screen player ──────────────────────────────────────────
  return (
    <div ref={dismissRef} style={{ position: "fixed", inset: 0 }}>
      <SetDownGrabber onDismiss={handleClose} visualTarget={dismissRef} />
      <FullPracticePlayer hook={hook} onClose={handleClose} onEnterFlow={() => setFlowMode(true)} />
    </div>
  );
}
