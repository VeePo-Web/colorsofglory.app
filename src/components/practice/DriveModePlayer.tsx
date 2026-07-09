import { SkipBack, SkipForward, Play, Pause, RotateCcw, Navigation2 } from "lucide-react";
import { getSectionColor } from "@/lib/audio/sectionColors";
import { KaraokeLyrics } from "./KaraokeLyrics";
import type { PracticePlayerHook } from "@/hooks/usePracticePlayer";

interface DriveModePlayerProps {
  hook: PracticePlayerHook;
}

/**
 * Drive Mode — a completely separate render tree for safe driving use.
 * - Giant touch targets (min 80px)
 * - Entire background shifts to the active section's color
 * - No small controls, no settings — just play/pause + nav
 * - Section color identity for peripheral-vision recognition
 */
export function DriveModePlayer({ hook }: DriveModePlayerProps) {
  const { state, play, pause, goToPrevSection, goToNextSection, restartCurrentSection, toggleDriveMode } = hook;
  const { status, activeSectionIndex, sections, loopCount, currentPositionMs, showLyrics } = state;

  const activeSection = sections[activeSectionIndex];
  const colors = activeSection ? getSectionColor(activeSection.label) : getSectionColor("");

  const isPlaying = status === "playing";

  const progressPct = activeSection && activeSection.durationMs > 0
    ? Math.min((currentPositionMs / activeSection.durationMs) * 100, 100)
    : 0;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{
        backgroundColor: colors.bg,
        transition: "background-color 400ms var(--cog-ease)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Exit bar — clearly labelled */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={toggleDriveMode}
          className="flex items-center gap-2 rounded-full px-4 py-2"
          style={{
            backgroundColor: "rgba(0,0,0,0.20)",
            color: colors.text,
            fontFamily: "var(--font-body)",
            fontSize: "0.875rem",
            fontWeight: 600,
            border: "none",
            minHeight: 44,
          }}
        >
          <Navigation2 size={16} />
          Exit drive mode
        </button>

        {/* Loop counter */}
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            minWidth: 52,
            height: 52,
            backgroundColor: "rgba(0,0,0,0.20)",
            color: colors.text,
            fontFamily: "var(--font-display)",
            fontSize: "1.125rem",
            fontWeight: 700,
          }}
        >
          ×{loopCount}
        </div>
      </div>

      {/* Section label — very large */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {activeSection?.songTitle && (
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: colors.text,
              opacity: 0.72,
              textAlign: "center",
              marginBottom: "-0.75rem",
            }}
          >
            {activeSection.songTitle}
          </div>
        )}
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.5rem, 10vw, 4rem)",
            fontWeight: 700,
            color: colors.text,
            textAlign: "center",
            lineHeight: 1.1,
            textShadow: "0 2px 16px rgba(0,0,0,0.20)",
          }}
        >
          {activeSection?.label ?? "—"}
        </div>

        {/* Karaoke — large drive mode variant */}
        {activeSection && (
          <KaraokeLyrics
            lyrics={activeSection.lyrics}
            transcriptLines={activeSection.transcriptLines}
            currentPositionMs={currentPositionMs}
            show={showLyrics}
            driveMode
          />
        )}
      </div>

      {/* Progress bar */}
      <div className="px-6">
        <div
          className="rounded-full overflow-hidden"
          style={{ height: 6, backgroundColor: "rgba(0,0,0,0.20)" }}
        >
          <div
            className="rounded-full transition-all"
            style={{
              height: "100%",
              width: `${progressPct}%`,
              backgroundColor: colors.text,
              transition: "width 300ms linear",
            }}
          />
        </div>
      </div>

      {/* Giant transport controls */}
      <div className="flex items-center justify-between px-8 py-6 gap-4">

        {/* Prev section */}
        <button
          onClick={goToPrevSection}
          aria-label="Previous section"
          className="flex items-center justify-center rounded-full"
          style={driveBtn()}
        >
          <SkipBack size={32} color={colors.text} />
        </button>

        {/* Restart current (left of play) */}
        <button
          onClick={restartCurrentSection}
          aria-label="Restart section"
          className="flex items-center justify-center rounded-full"
          style={{ ...driveBtn(), width: 72, height: 72 }}
        >
          <RotateCcw size={28} color={colors.text} />
        </button>

        {/* Play / Pause — largest */}
        <button
          onClick={isPlaying ? pause : play}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex items-center justify-center rounded-full"
          style={{
            width: 100,
            height: 100,
            backgroundColor: "rgba(0,0,0,0.25)",
            border: `3px solid ${colors.text}`,
            flexShrink: 0,
            transition: "transform 100ms",
          }}
        >
          {isPlaying
            ? <Pause size={44} fill={colors.text} color={colors.text} />
            : <Play  size={44} fill={colors.text} color={colors.text} style={{ marginLeft: 4 }} />
          }
        </button>

        {/* Placeholder for symmetry (invisible) */}
        <div style={{ width: 72, height: 72, flexShrink: 0 }} />

        {/* Next section */}
        <button
          onClick={goToNextSection}
          aria-label="Next section"
          className="flex items-center justify-center rounded-full"
          style={driveBtn()}
        >
          <SkipForward size={32} color={colors.text} />
        </button>
      </div>

      {/* Safe-area spacer */}
      <div style={{ height: 16 }} />
    </div>
  );
}

function driveBtn(): React.CSSProperties {
  return {
    width: 80,
    height: 80,
    backgroundColor: "rgba(0,0,0,0.20)",
    border: "none",
    flexShrink: 0,
    transition: "transform 100ms",
  };
}
