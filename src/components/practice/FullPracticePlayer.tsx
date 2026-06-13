import { useState } from "react";
import {
  ChevronDown,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  RotateCcw,
  Settings2,
  Navigation2,
  ListOrdered,
  Type,
  Mic,
} from "lucide-react";
import { getSectionColor } from "@/lib/audio/sectionColors";
import { SectionStrip } from "./SectionStrip";
import { KaraokeLyrics } from "./KaraokeLyrics";
import { PracticeSettingsTray } from "./PracticeSettingsTray";
import { SequenceBuilder } from "./SequenceBuilder";
import { SessionSummaryCard } from "./SessionSummaryCard";
import type { PracticePlayerHook } from "@/hooks/usePracticePlayer";

interface FullPracticePlayerProps {
  hook: PracticePlayerHook;
  onClose: () => void;
}

export function FullPracticePlayer({ hook, onClose }: FullPracticePlayerProps) {
  const {
    state,
    play, pause, goToSection, goToPrevSection, goToNextSection, restartCurrentSection,
    setLoopMode, setPlaybackSpeed, setGapMs, setRepeatPerSection, setCountInEnabled,
    setSpeedTrainer, setTimerEndTimeMs, toggleDriveMode, setSequence, setShowLyrics,
    dismissSummary, endSession,
  } = hook;

  const [showSettings, setShowSettings]   = useState(false);
  const [showSequence, setShowSequence]   = useState(false);

  const { status, activeSectionIndex, sections, loopCount, currentPositionMs, driveMode, showSummary } = state;

  const activeSection = sections[activeSectionIndex];
  const colors = activeSection ? getSectionColor(activeSection.label) : getSectionColor("");

  const isPlaying = status === "playing";
  const isCaching = status === "caching";

  const progressPct = activeSection && activeSection.durationMs > 0
    ? Math.min((currentPositionMs / activeSection.durationMs) * 100, 100)
    : 0;

  // Handle timer set (convert minutes to end epoch)
  const handleSetTimerMinutes = (minutes: number | null) => {
    setTimerEndTimeMs(minutes ? Date.now() + minutes * 60000 : null);
  };

  return (
    <>
      {/* Full-screen overlay */}
      <div
        className="fixed inset-0 z-30 flex flex-col"
        style={{
          backgroundColor: "var(--cog-cream)",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Warm glow background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 70% 45% at 50% 85%, ${colors.glow} 0%, transparent 70%)`,
            transition: "background 600ms var(--cog-ease)",
          }}
        />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-4 py-3">
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full"
            style={{ width: 40, height: 40, backgroundColor: "rgba(28,26,23,0.07)", color: "var(--cog-warm-gray)" }}
          >
            <ChevronDown size={22} />
          </button>

          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.9375rem",
              fontWeight: 600,
              color: "var(--cog-charcoal)",
              maxWidth: "55%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {state.songTitle}
          </div>

          <div className="flex items-center gap-2">
            {/* Drive mode toggle */}
            <button
              onClick={toggleDriveMode}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 40, height: 40,
                backgroundColor: driveMode ? colors.chipBg : "rgba(28,26,23,0.07)",
                color: driveMode ? colors.bg : "var(--cog-warm-gray)",
              }}
            >
              <Navigation2 size={18} />
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center justify-center rounded-full"
              style={{ width: 40, height: 40, backgroundColor: "rgba(28,26,23,0.07)", color: "var(--cog-warm-gray)" }}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </div>

        {/* Section strip */}
        <div className="relative z-10 py-2">
          <SectionStrip
            sections={sections}
            activeSectionIndex={activeSectionIndex}
            onSelect={goToSection}
          />
        </div>

        {/* Active section label + loop counter */}
        <div className="relative z-10 flex flex-col items-center px-6 pt-6 pb-2 gap-1">
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 8vw, 3rem)",
              fontWeight: 700,
              color: "var(--cog-charcoal)",
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            {activeSection?.label ?? "—"}
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--cog-warm-gray)",
            }}
          >
            {loopCount === 0 ? "Ready" : `×${loopCount} loop${loopCount !== 1 ? "s" : ""}`}
            {state.speedTrainer.enabled && (
              <span style={{ marginLeft: 8, color: colors.bg, fontWeight: 600 }}>
                {state.speedTrainer.currentSpeed}×
              </span>
            )}
          </div>
        </div>

        {/* Lyrics */}
        <div className="relative z-10 flex-1 flex flex-col justify-center overflow-hidden">
          {isCaching ? (
            <div className="flex items-center justify-center gap-2 px-6">
              <Mic size={16} color="var(--cog-muted)" />
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--cog-muted)" }}>
                Loading audio…
              </span>
            </div>
          ) : activeSection ? (
            <KaraokeLyrics
              lyrics={activeSection.lyrics}
              transcriptLines={activeSection.transcriptLines}
              currentPositionMs={currentPositionMs}
              show={state.showLyrics}
            />
          ) : null}
        </div>

        {/* Progress bar */}
        <div className="relative z-10 px-6 pb-4">
          <div
            className="rounded-full overflow-hidden"
            style={{ height: 4, backgroundColor: "rgba(28,26,23,0.10)" }}
          >
            <div
              className="rounded-full"
              style={{
                height: "100%",
                width: `${progressPct}%`,
                backgroundColor: colors.bg,
                transition: "width 200ms linear",
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--cog-muted)" }}>
              {formatMs(currentPositionMs)}
            </span>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--cog-muted)" }}>
              {activeSection ? formatMs(activeSection.durationMs) : "--:--"}
            </span>
          </div>
        </div>

        {/* Main transport controls */}
        <div className="relative z-10 flex items-center justify-center gap-6 px-6 pb-4">
          {/* Prev section */}
          <IconBtn onClick={goToPrevSection} size={48}>
            <SkipBack size={24} color="var(--cog-warm-gray)" />
          </IconBtn>

          {/* Restart (replay from start of this section) */}
          <IconBtn onClick={restartCurrentSection} size={48}>
            <RotateCcw size={22} color="var(--cog-warm-gray)" />
          </IconBtn>

          {/* Play / Pause — primary */}
          <button
            onClick={isPlaying ? pause : play}
            className="flex items-center justify-center rounded-full transition-all active:scale-[0.94]"
            style={{
              width: 72,
              height: 72,
              backgroundColor: colors.bg,
              boxShadow: `0 6px 24px ${colors.glow}`,
              border: "none",
              flexShrink: 0,
            }}
          >
            {isPlaying
              ? <Pause size={32} fill="#fff" color="#fff" />
              : <Play  size={32} fill="#fff" color="#fff" style={{ marginLeft: 3 }} />
            }
          </button>

          {/* Next section */}
          <IconBtn onClick={goToNextSection} size={48}>
            <SkipForward size={24} color="var(--cog-warm-gray)" />
          </IconBtn>

          {/* Sequence mode toggle */}
          <IconBtn onClick={() => setShowSequence(true)} size={48}>
            <ListOrdered size={22} color={state.loopMode === "sequence" ? colors.bg : "var(--cog-warm-gray)"} />
          </IconBtn>
        </div>

        {/* Secondary controls row */}
        <div className="relative z-10 flex items-center justify-center gap-4 px-6 pb-6">
          {/* Loop mode chip */}
          <LoopModeChip loopMode={state.loopMode} color={colors.bg} />

          {/* Lyrics toggle */}
          <button
            onClick={() => setShowLyrics(!state.showLyrics)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all"
            style={{
              backgroundColor: state.showLyrics ? "rgba(184,149,58,0.12)" : "rgba(28,26,23,0.06)",
              color: state.showLyrics ? colors.bg : "var(--cog-warm-gray)",
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              border: "none",
            }}
          >
            <Type size={13} />
            Lyrics
          </button>

          {/* Speed label */}
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1 rounded-full px-3 py-1.5"
            style={{
              backgroundColor: state.playbackSpeed !== 1.0 ? "rgba(184,149,58,0.12)" : "rgba(28,26,23,0.06)",
              color: state.playbackSpeed !== 1.0 ? colors.bg : "var(--cog-warm-gray)",
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              border: "none",
            }}
          >
            {state.playbackSpeed}×
          </button>
        </div>
      </div>

      {/* Settings tray */}
      {showSettings && (
        <PracticeSettingsTray
          state={state}
          onClose={() => setShowSettings(false)}
          onSetLoopMode={setLoopMode}
          onSetPlaybackSpeed={setPlaybackSpeed}
          onSetGapMs={setGapMs}
          onSetRepeatPerSection={setRepeatPerSection}
          onSetCountIn={setCountInEnabled}
          onSetSpeedTrainer={setSpeedTrainer}
          onSetTimerMinutes={handleSetTimerMinutes}
        />
      )}

      {/* Sequence builder */}
      {showSequence && (
        <SequenceBuilder
          sections={sections}
          sequence={state.sequence}
          onConfirm={seq => {
            setSequence(seq);
            setLoopMode("sequence");
            setShowSequence(false);
          }}
          onCancel={() => setShowSequence(false)}
        />
      )}

      {/* Session summary */}
      {showSummary && (
        <SessionSummaryCard state={state} onDismiss={dismissSummary} />
      )}
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function IconBtn({
  onClick,
  size,
  children,
}: {
  onClick: () => void;
  size: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-full transition-all active:scale-[0.92]"
      style={{ width: size, height: size, backgroundColor: "rgba(28,26,23,0.06)", border: "none" }}
    >
      {children}
    </button>
  );
}

function LoopModeChip({ loopMode, color }: { loopMode: string; color: string }) {
  const labels: Record<string, string> = {
    single:       "Single loop",
    sequence:     "Sequence",
    all:          "All sections",
    "run-through": "Run-through",
  };
  return (
    <div
      className="flex items-center gap-1 rounded-full px-3 py-1.5"
      style={{
        backgroundColor: "rgba(184,149,58,0.10)",
        color,
        fontFamily: "var(--font-body)",
        fontSize: "0.8125rem",
        fontWeight: 500,
      }}
    >
      {labels[loopMode] ?? loopMode}
    </div>
  );
}

function formatMs(ms: number): string {
  if (!ms || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min      = Math.floor(totalSec / 60);
  const sec      = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
