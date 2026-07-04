import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Repeat, ChevronRight, Disc3, Music2 } from "lucide-react";
import { setNavDirection } from "@/lib/nav/navDirection";
import { loadMostRecentSession, practiceRouteForSession } from "@/lib/audio/practiceStorage";
import { usePracticeContext } from "@/hooks/usePracticeContext";

/**
 * "Resume practice" card for the library home — the open-app → one-tap → drive
 * moment. Surfaces the single most-recent saved practice session (song OR
 * album) and drops the songwriter straight back into the exact section they
 * left off on. Hidden while a session is already live (the mini-player owns
 * that), and renders nothing when there's nothing to resume.
 */
export default function PracticeResumeCard() {
  const navigate = useNavigate();
  const { state } = usePracticeContext();

  // Recompute on each render of the catalog mount; cheap localStorage read.
  const session = useMemo(() => loadMostRecentSession(), []);

  // A session is already live — the mini-player is the continuity surface.
  const live = state.status === "playing" || state.status === "paused" || state.status === "ready";
  if (live || !session) return null;

  const isAlbum = session.songId.startsWith("album:");
  const title = session.title ?? (isAlbum ? "Album" : "Song");
  const detail = session.sectionLabel
    ? `${session.sectionLabel}${session.loopCount ? ` · ×${session.loopCount}` : ""}`
    : "Pick up where you left off";

  const handleResume = () => {
    setNavDirection("up");
    navigate(practiceRouteForSession(session), { state: { songTitle: session.title } });
  };

  return (
    <button
      onClick={handleResume}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl px-3.5 text-left transition-transform duration-150 active:scale-[0.98]"
      style={{
        minHeight: 64,
        backgroundColor: "var(--cog-cream-light)",
        border: "1px solid var(--cog-border-gold)",
        boxShadow: "0 10px 24px -14px rgba(184,149,58,0.5)",
      }}
      aria-label={`Resume practice — ${title}, ${detail}`}
    >
      <div
        className="flex flex-shrink-0 items-center justify-center rounded-xl"
        style={{ width: 44, height: 44, backgroundColor: "var(--cog-gold)" }}
      >
        <Repeat size={20} strokeWidth={2.4} color="#fff" />
      </div>

      <div className="min-w-0 flex-1">
        <div
          className="flex items-center gap-1"
          style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--cog-gold)" }}
        >
          {isAlbum ? <Disc3 size={12} strokeWidth={2.4} /> : <Music2 size={12} strokeWidth={2.4} />}
          Resume practice
        </div>
        <div
          className="truncate"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.0625rem", fontWeight: 700, color: "var(--cog-charcoal)", lineHeight: 1.2 }}
        >
          {title}
        </div>
        <div
          className="truncate"
          style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--cog-warm-gray)" }}
        >
          {detail}
        </div>
      </div>

      <ChevronRight size={20} strokeWidth={2} style={{ color: "var(--cog-muted)", flexShrink: 0 }} />
    </button>
  );
}
