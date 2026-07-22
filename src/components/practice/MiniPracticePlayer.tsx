import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Play, Pause, SkipForward, X, ChevronUp } from "lucide-react";
import { getSectionColor } from "@/lib/audio/sectionColors";
import { usePracticeContext } from "@/hooks/usePracticeContext";
import { setNavDirection } from "@/lib/nav/navDirection";
import { useLiftGesture } from "@/components/practice/useLiftGesture";

/**
 * The Flow handle (docs/FLOW-ACCESS-CONTRACT.md) — the evolved mini-player.
 *
 * Two states, one grammar (the universal now-playing pull-up):
 *  · ENTRY — on a song's surfaces (room/sheet/voice/canvas) with no session:
 *    a slim "Flow · lift to play" bar. Swipe UP on it (or tap) to lift the
 *    song into the perform mode.
 *  · ACTIVE — while a session runs, anywhere in the app: the persistent
 *    48px now-playing bar (section · play/pause · skip · end). Swipe UP
 *    (or tap) re-lifts into the full player.
 *
 * The drag zone is the bar itself (useLiftGesture) — it can never fight
 * canvas pan, list scroll, or the horizontal pager. The tap is the
 *contract; the swipe is the accelerator. Reduced motion skips the visual
 * tracking; everything stays tappable.
 */

/** Song surfaces that carry the ENTRY handle (capture stays sacred). */
const ENTRY_SURFACE = /^\/songs\/([^/]+)\/(room|sheet|lyrics|chords|voice|canvas)$/;

/**
 * The sheet's writing trance is sacred — while any text input has focus
 * (the keyboard is up), the entry handle vanishes so it can never float
 * over the active line on iOS's shifted visual viewport.
 */
function useTextInputFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    const isText = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    const onIn = (e: FocusEvent) => {
      if (isText(e.target)) setFocused(true);
    };
    const onOut = () => {
      // Re-check after the focus settles (moving between fields stays hidden).
      window.setTimeout(() => {
        setFocused(isText(document.activeElement));
      }, 50);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return focused;
}

export function MiniPracticePlayer() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state, play, pause, goToNextSection, endSession } = usePracticeContext();
  const keyboardUp = useTextInputFocused();

  const { status, activeSectionIndex, sections, loopCount, songId, songTitle } = state;
  const sessionActive = status === "playing" || status === "paused" || status === "ready";

  const entryMatch = pathname.match(ENTRY_SURFACE);
  const entrySongId = entryMatch?.[1] ?? null;

  const barRef = useRef<HTMLDivElement>(null);

  // ── The lift (shared by both states) ──────────────────────────────────
  const lift = useCallback(() => {
    if (sessionActive) {
      // An album session is keyed `album:<id>` — it must reopen on the album
      // route. Song sessions carry their sections in nav state so expand is
      // instant.
      setNavDirection("up");
      if (songId.startsWith("album:")) {
        navigate(`/albums/${songId.slice("album:".length)}/practice`);
      } else {
        navigate(`/songs/${songId}/practice`, { state: { songTitle, sections } });
      }
    } else if (entrySongId) {
      // Lift straight into Flow — the practice page self-loads the song's
      // sections on a cold open, and `flow: true` lands in perform mode.
      setNavDirection("up");
      navigate(`/songs/${entrySongId}/practice`, { state: { flow: true } });
    }
  }, [sessionActive, songId, songTitle, sections, entrySongId, navigate]);

  useLiftGesture(barRef, {
    onLiftUp: lift,
    disabled: !sessionActive && !entrySongId,
  });

  // ── ENTRY state — the calm "lift to play" handle ──────────────────────
  if (!sessionActive) {
    if (!entrySongId || keyboardUp) return null;
    return (
      <div
        ref={barRef}
        className="fixed left-0 right-0 z-40 flex justify-center"
        // 104px clears every song surface's bottom bar (room dock, sheet's
        // Add-section bar, voice's recorder panel, the canvas dock) with a
        // calm gap; the ACTIVE bar keeps its established 80px slot.
        style={{ bottom: 104, animation: "mini-in 250ms var(--cog-ease-reveal) both" }}
      >
        <button
          type="button"
          onClick={lift}
          aria-label="Lift to play in Flow"
          className="flex flex-col items-center transition-transform active:scale-[0.97]"
          style={{
            background: "var(--cog-cream-light)",
            border: "1px solid rgba(184,149,58,0.30)",
            borderRadius: 999,
            boxShadow: "0 2px 14px rgba(28,26,23,0.10)",
            padding: "7px 22px 9px",
            minHeight: 48,
            cursor: "pointer",
          }}
        >
          {/* The grabber — the universal "this pulls up" cue. */}
          <span
            aria-hidden="true"
            style={{
              width: 32,
              height: 4,
              borderRadius: 999,
              backgroundColor: "rgba(184,149,58,0.45)",
              marginBottom: 4,
            }}
          />
          <span className="flex items-center gap-1.5">
            <ChevronUp size={14} strokeWidth={2.2} style={{ color: "var(--cog-gold)" }} />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                color: "var(--cog-charcoal)",
              }}
            >
              Flow
            </span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12.5,
                color: "var(--cog-warm-gray)",
              }}
            >
              · lift to play
            </span>
          </span>
        </button>
        <style>{`
          @keyframes mini-in {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // ── ACTIVE state — the persistent now-playing bar ─────────────────────
  const activeSection = sections[activeSectionIndex];
  const colors = activeSection ? getSectionColor(activeSection.label) : getSectionColor("");
  const isPlaying = status === "playing";

  return (
    <div
      ref={barRef}
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
      {/* The grabber — swipe up re-lifts (tap works too). */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 3,
          left: "50%",
          transform: "translateX(-50%)",
          width: 28,
          height: 3,
          borderRadius: 999,
          backgroundColor: "rgba(28,26,23,0.18)",
        }}
      />

      {/* Left: tap to expand */}
      <button
        onClick={lift}
        aria-label={`Now performing — tap to expand ${activeSection?.label ?? "practice"}`}
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
          aria-label={isPlaying ? "Pause practice" : "Resume practice"}
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
          aria-label="Next section"
          className="flex items-center justify-center rounded-full transition-all active:scale-[0.90]"
          style={{ width: 36, height: 36, backgroundColor: "rgba(28,26,23,0.06)", border: "none" }}
        >
          <SkipForward size={16} color="var(--cog-warm-gray)" />
        </button>

        {/* Dismiss session */}
        <button
          onClick={e => { e.stopPropagation(); endSession(); }}
          aria-label="End practice session"
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
