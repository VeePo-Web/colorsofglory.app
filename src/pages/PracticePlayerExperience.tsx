import { useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { goBackOr } from "@/lib/nav/safeBack";
import { usePracticeContext } from "@/hooks/usePracticeContext";
import { DriveModePlayer } from "@/components/practice/DriveModePlayer";
import { FullPracticePlayer } from "@/components/practice/FullPracticePlayer";
import { loadSession, loadLoopMode } from "@/lib/audio/practiceStorage";
import type { PracticeSection } from "@/lib/audio/practiceTypes";

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
  const { state, initSession } = hook;

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

    // Navigation state injected by SongCanvasExperience (or CapturePage)
    const navState = (window.history.state?.usr ?? {}) as {
      songTitle?: string;
      sections?: PracticeSection[];
    };

    const title    = navState.songTitle ?? "Untitled Song";
    const sections = navState.sections  ?? [];

    // Restore persisted session if available
    const persisted = loadSession(songId);
    const savedMode = loadLoopMode(songId);
    if (savedMode) hook.setLoopMode(savedMode);

    initSession(songId, title, sections, persisted ?? undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  // Idle / no sections
  if (state.status === "idle") {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-4"
        style={{ backgroundColor: "var(--cog-cream)" }}
      >
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.9375rem", color: "var(--cog-muted)" }}>
          No sections with voice memos found for this song.
        </p>
        <button
          onClick={handleClose}
          className="rounded-full px-6 py-2"
          style={{
            backgroundColor: "var(--cog-gold)",
            color: "#fff",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            border: "none",
          }}
        >
          Go back
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

  // ─── Drive Mode — separate render tree ─────────────────────────────────
  if (state.driveMode) {
    return <DriveModePlayer hook={hook} />;
  }

  // ─── Normal full-screen player ──────────────────────────────────────────
  return <FullPracticePlayer hook={hook} onClose={handleClose} />;
}
