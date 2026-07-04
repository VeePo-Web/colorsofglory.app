import { useNavigate } from "react-router-dom";
import { Play, Pause, SkipForward, X } from "lucide-react";
import { getSectionColor } from "@/lib/audio/sectionColors";
import { usePracticeContext } from "@/hooks/usePracticeContext";

/**
 * Persistent 48px mini-player bar sitting directly above BottomNav (bottom: 80px).
 * Only renders when a practice session is active (status is playing/paused/ready).
 * Tapping anywhere on the bar navigates back to the full player.
 */
export function MiniPracticePlayer() {
  const navigate = useNavigate();
  const { state, play, pause, goToNextSection, endSession } = usePracticeContext();

  const { status, activeSectionIndex, sections, loopCount, songId, songTitle } = state;

  const isVisible = status === "playing" || status === "paused" || status === "ready";
  if (!isVisible) return null;

  const activeSection = sections[activeSectionIndex];
  const colors = activeSection ? getSectionColor(activeSection.label) : getSectionColor("");
  const isPlaying = status === "playing";

  // An album session is keyed `album:<id>` — it must reopen on the album route,
  // not `/songs/album:<id>/practice` (which would dead-end). Song sessions
  // carry their sections in nav state so expand is instant.
  const isAlbum = songId.startsWith("album:");
  const handleBarClick = () => {
    if (isAlbum) {
      navigate(`/albums/${songId.slice("album:".length)}/practice`);
    } else {
      navigate(`/songs/${songId}/practice`, { state: { songTitle, sections } });
    }
  };

  return (
    <div
      className="fixed left-0 right-0 z-40 flex items-center"
      style={{
        bottom: 80, // sits just above BottomNav
        height: 52,
        backgroundColor: "var(--cog-cream-light)",
        borderTop: `2px solid ${colors.chipBg}`,
        boxShadow: "0 -2px 12px rgba(28,26,23,0.08)",
        animation: "mini-in 250ms var(--cog-ease-reveal) both",
        paddingInline: 12,
        gap: 8,
      }}
    >
      {/* Left: tap to expand */}
      <button
        onClick={handleBarClick}
        className="flex-1 flex items-center gap-3 min-w-0 text-left"
        style={{ background: "none", border: "none", padding: 0, height: "100%" }}
      >
        {/* Color indicator dot */}
        <div
          className="flex-shrink-0 rounded-full"
          style={{ width: 8, height: 8, backgroundColor: colors.bg }}
        />

        {/* Section label — prefixed with the song in album mode so a driver
            glancing down always knows which song is looping. */}
        <span
          className="min-w-0 flex-1"
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {activeSection?.songTitle && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "var(--cog-gold)",
              }}
            >
              {activeSection.songTitle}
              <span style={{ color: "var(--cog-muted)", fontWeight: 500 }}>{"  ·  "}</span>
            </span>
          )}
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--cog-charcoal)",
            }}
          >
            {activeSection?.label ?? "Practice"}
          </span>
        </span>

        {/* Loop counter */}
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--cog-warm-gray)",
            flexShrink: 0,
          }}
        >
          ×{loopCount}
        </span>
      </button>

      {/* Controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Play / Pause */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isPlaying) pause();
            else play();
          }}
          className="flex items-center justify-center rounded-full transition-all active:scale-[0.90]"
          style={{ width: 36, height: 36, backgroundColor: colors.bg, border: "none" }}
        >
          {isPlaying
            ? <Pause size={16} fill="#fff" color="#fff" />
            : <Play  size={16} fill="#fff" color="#fff" style={{ marginLeft: 1 }} />
          }
        </button>

        {/* Skip forward */}
        <button
          onClick={e => { e.stopPropagation(); goToNextSection(); }}
          className="flex items-center justify-center rounded-full transition-all active:scale-[0.90]"
          style={{ width: 36, height: 36, backgroundColor: "rgba(28,26,23,0.06)", border: "none" }}
        >
          <SkipForward size={16} color="var(--cog-warm-gray)" />
        </button>

        {/* Dismiss session */}
        <button
          onClick={e => { e.stopPropagation(); endSession(); }}
          className="flex items-center justify-center rounded-full transition-all active:scale-[0.90]"
          style={{ width: 36, height: 36, backgroundColor: "rgba(28,26,23,0.06)", border: "none" }}
        >
          <X size={15} color="var(--cog-warm-gray)" />
        </button>
      </div>

      <style>{`
        @keyframes mini-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
