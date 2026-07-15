import { useMemo, useRef, useState } from "react";
import {
  AudioLines,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
  Waves,
} from "lucide-react";
import { getSectionColor } from "@/lib/audio/sectionColors";
import { SectionStrip } from "./SectionStrip";
import { KaraokeLyrics } from "./KaraokeLyrics";
import { ChordScroll } from "./ChordScroll";
import { PracticeSettingsTray } from "./PracticeSettingsTray";
import { SequenceBuilder } from "./SequenceBuilder";
import { SessionSummaryCard } from "./SessionSummaryCard";
import { ABLoopBar } from "./ABLoopBar";
import { effectiveClickBpm, type PracticePlayerHook } from "@/hooks/usePracticePlayer";

interface FullPracticePlayerProps {
  hook: PracticePlayerHook;
  onClose: () => void;
  /** Enter Flow — the hands-free autoscroll perform mode. */
  onEnterFlow?: () => void;
}

export function FullPracticePlayer({ hook, onClose, onEnterFlow }: FullPracticePlayerProps) {
  const {
    state,
    play, pause, goToSection, goToPrevSection, goToNextSection, goToPrevSong, goToNextSong, restartCurrentSection,
    setLoopMode, setLoopRegion, setPlaybackSpeed, setGapMs, setRepeatPerSection, setCountInEnabled,
    setSpeedTrainer, setTimerEndTimeMs, toggleDriveMode, setSequence, setShowLyrics,
    setActiveTake, toggleMetronome, setBpm,
    dismissSummary, endSession,
  } = hook;

  const [showSettings, setShowSettings]   = useState(false);
  const [showSequence, setShowSequence]   = useState(false);

  const { status, activeSectionIndex, sections, loopCount, currentPositionMs, driveMode, showSummary } = state;

  const activeSection = sections[activeSectionIndex];
  const colors = activeSection ? getSectionColor(activeSection.label) : getSectionColor("");

  // Album mode — the flattened section list spans several songs. Surface a
  // song-level skip so a solid song can be left in one tap, not five.
  const albumSongs = useMemo(() => {
    const seen: string[] = [];
    for (const s of sections) if (s.songId && !seen.includes(s.songId)) seen.push(s.songId);
    return seen;
  }, [sections]);
  const isAlbum = albumSongs.length > 1;
  const songIndex = activeSection?.songId ? albumSongs.indexOf(activeSection.songId) : -1;

  const isPlaying = status === "playing";
  const isCaching = status === "caching";

  // Handle timer set (convert minutes to end epoch)
  const handleSetTimerMinutes = (minutes: number | null) => {
    setTimerEndTimeMs(minutes ? Date.now() + minutes * 60000 : null);
  };

  // ─── Take-swiping (F15) ────────────────────────────────────────────────
  const takes = activeSection?.takes;
  const hasMultipleTakes = !!takes && takes.length > 1;
  const activeTakeIndex = activeSection?.activeTakeIndex ?? 0;
  const activeTake = takes?.[activeTakeIndex];

  const goToTake = (index: number) => {
    if (!takes || index < 0 || index >= takes.length) return;
    void setActiveTake(activeSectionIndex, index);
  };

  // Horizontal swipe on the lyric/take area switches takes.
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const onSwipeStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0]?.clientX ?? null;
    swipeStartY.current = e.touches[0]?.clientY ?? null;
  };
  const onSwipeEnd = (e: React.TouchEvent) => {
    const startX = swipeStartX.current;
    const startY = swipeStartY.current;
    swipeStartX.current = null;
    swipeStartY.current = null;
    if (startX == null || startY == null || !hasMultipleTakes) return;
    const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
    const dy = (e.changedTouches[0]?.clientY ?? startY) - startY;
    // Horizontal intent only — vertical is the chart scroll.
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    goToTake(activeTakeIndex + (dx < 0 ? 1 : -1));
  };

  const hasChordChart = !!activeSection?.chordLines && activeSection.chordLines.length > 0;

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
            aria-label="Close practice player"
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
            {/* Flow — hands-free autoscroll perform mode */}
            {onEnterFlow && (
              <button
                onClick={onEnterFlow}
                aria-label="Enter Flow — the whole song scrolls by while you play"
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 40, height: 40,
                  backgroundColor: "rgba(28,26,23,0.07)",
                  color: "var(--cog-warm-gray)",
                }}
              >
                <Waves size={18} />
              </button>
            )}

            {/* Drive mode toggle */}
            <button
              onClick={toggleDriveMode}
              aria-label={driveMode ? "Exit drive mode" : "Enter drive mode"}
              aria-pressed={driveMode}
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
              aria-label="Practice settings"
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
          {activeSection?.songTitle && (
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--cog-gold)",
              }}
            >
              {activeSection.songTitle}
            </div>
          )}
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

          {/* Take swiper (F15) — swipe or tap between this section's takes */}
          {hasMultipleTakes && (
            <div
              className="flex items-center gap-2 mt-1"
              onTouchStart={onSwipeStart}
              onTouchEnd={onSwipeEnd}
              role="group"
              aria-label={`Takes for ${activeSection?.label ?? "this section"}`}
            >
              <button
                onClick={() => goToTake(activeTakeIndex - 1)}
                disabled={activeTakeIndex === 0}
                aria-label="Previous take"
                className="flex items-center justify-center rounded-full active:scale-95"
                style={{
                  width: 32, height: 32, border: "none",
                  backgroundColor: "rgba(28,26,23,0.06)",
                  color: activeTakeIndex === 0 ? "var(--cog-muted)" : "var(--cog-warm-gray)",
                  opacity: activeTakeIndex === 0 ? 0.5 : 1,
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex flex-col items-center" style={{ minWidth: 120 }}>
                <span
                  style={{
                    fontFamily: "var(--font-body)", fontSize: "0.8125rem", fontWeight: 600,
                    color: "var(--cog-charcoal)", maxWidth: 180, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {activeTake?.label ?? `Take ${activeTakeIndex + 1}`}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5" aria-hidden>
                  {takes!.map((_, i) => (
                    <span
                      key={i}
                      className="rounded-full"
                      style={{
                        width: i === activeTakeIndex ? 14 : 5,
                        height: 5,
                        backgroundColor: i === activeTakeIndex ? colors.bg : "rgba(28,26,23,0.18)",
                        transition: "all 200ms var(--cog-ease)",
                      }}
                    />
                  ))}
                </div>
                <span className="sr-only" role="status">
                  Take {activeTakeIndex + 1} of {takes!.length}
                </span>
              </div>

              <button
                onClick={() => goToTake(activeTakeIndex + 1)}
                disabled={activeTakeIndex === takes!.length - 1}
                aria-label="Next take"
                className="flex items-center justify-center rounded-full active:scale-95"
                style={{
                  width: 32, height: 32, border: "none",
                  backgroundColor: "rgba(28,26,23,0.06)",
                  color: activeTakeIndex === takes!.length - 1 ? "var(--cog-muted)" : "var(--cog-warm-gray)",
                  opacity: activeTakeIndex === takes!.length - 1 ? 0.5 : 1,
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Lyrics + chords — the music stand. Chord chart (C3) when the song
            has one; karaoke transcript otherwise. Swipe left/right = takes. */}
        <div
          className="relative z-10 flex-1 min-h-0 flex flex-col justify-center overflow-hidden"
          onTouchStart={onSwipeStart}
          onTouchEnd={onSwipeEnd}
        >
          {isCaching ? (
            <div className="flex items-center justify-center gap-2 px-6">
              <Mic size={16} color="var(--cog-muted)" />
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem", color: "var(--cog-muted)" }}>
                Loading audio…
              </span>
            </div>
          ) : activeSection && hasChordChart ? (
            <ChordScroll
              chordLines={activeSection.chordLines!}
              currentPositionMs={currentPositionMs}
              durationMs={activeSection.durationMs}
              songKey={state.songKey}
              show={state.showLyrics}
            />
          ) : activeSection ? (
            <KaraokeLyrics
              lyrics={activeSection.lyrics}
              transcriptLines={activeSection.transcriptLines}
              currentPositionMs={currentPositionMs}
              show={state.showLyrics}
            />
          ) : null}
        </div>

        {/* Progress bar + A/B loop window */}
        <ABLoopBar
          durationMs={activeSection?.durationMs ?? 0}
          positionMs={currentPositionMs}
          color={colors.bg}
          region={state.loopRegion}
          onRegionChange={setLoopRegion}
        />

        {/* Main transport controls */}
        <div className="relative z-10 flex items-center justify-center gap-6 px-6 pb-4">
          {/* Prev section */}
          <IconBtn onClick={goToPrevSection} size={48} label="Previous section">
            <SkipBack size={24} color="var(--cog-warm-gray)" />
          </IconBtn>

          {/* Restart (replay from start of this section) */}
          <IconBtn onClick={restartCurrentSection} size={48} label="Restart section">
            <RotateCcw size={22} color="var(--cog-warm-gray)" />
          </IconBtn>

          {/* Play / Pause — primary */}
          <button
            onClick={isPlaying ? pause : play}
            aria-label={isPlaying ? "Pause" : "Play"}
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
          <IconBtn onClick={goToNextSection} size={48} label="Next section">
            <SkipForward size={24} color="var(--cog-warm-gray)" />
          </IconBtn>

          {/* Sequence mode toggle */}
          <IconBtn onClick={() => setShowSequence(true)} size={48} label="Build practice sequence">
            <ListOrdered size={22} color={state.loopMode === "sequence" ? colors.bg : "var(--cog-warm-gray)"} />
          </IconBtn>
        </div>

        {/* Album song skip — "this song's solid, next song" in one tap */}
        {isAlbum && (
          <div className="relative z-10 flex items-center justify-center gap-3 px-6 pb-3">
            <button
              onClick={goToPrevSong}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 active:scale-95"
              style={{ backgroundColor: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)", border: "none", fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600, minHeight: 36 }}
              aria-label="Previous song"
            >
              <ChevronLeft size={15} /> Song
            </button>
            <span style={{ fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600, color: "var(--cog-muted)" }}>
              {songIndex >= 0 ? `${songIndex + 1} of ${albumSongs.length}` : `${albumSongs.length} songs`}
            </span>
            <button
              onClick={goToNextSong}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 active:scale-95"
              style={{ backgroundColor: "rgba(28,26,23,0.06)", color: "var(--cog-warm-gray)", border: "none", fontFamily: "var(--font-body)", fontSize: "0.75rem", fontWeight: 600, minHeight: 36 }}
              aria-label="Next song"
            >
              Song <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* Secondary controls row */}
        <div className="relative z-10 flex items-center justify-center gap-3 px-6 pb-6">
          {/* Loop mode chip */}
          <LoopModeChip loopMode={state.loopMode} color={colors.bg} />

          {/* Metronome toggle (F14 — C4's click engine). The dot pulses on
              the engine's own beat callback so eyes and ears agree. */}
          <button
            onClick={toggleMetronome}
            aria-label={state.metronomeOn ? "Turn metronome off" : "Turn metronome on"}
            aria-pressed={state.metronomeOn}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all"
            style={{
              backgroundColor: state.metronomeOn ? "rgba(184,149,58,0.14)" : "rgba(28,26,23,0.06)",
              color: state.metronomeOn ? colors.bg : "var(--cog-warm-gray)",
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              border: "none",
            }}
          >
            {state.metronomeOn ? (
              <span
                key={`beat-${state.metronomeBeat}`}
                aria-hidden
                className="rounded-full cog-beat-pulse"
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: state.metronomeBeat === 0 ? colors.bg : "rgba(184,149,58,0.55)",
                }}
              />
            ) : (
              <AudioLines size={13} aria-hidden />
            )}
            {state.metronomeOn ? `${effectiveClickBpm(state)} bpm` : "Click"}
          </button>

          {/* Lyrics toggle */}
          <button
            onClick={() => setShowLyrics(!state.showLyrics)}
            aria-label={state.showLyrics ? "Hide lyrics" : "Show lyrics"}
            aria-pressed={state.showLyrics}
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
            aria-label={`Playback speed ${state.playbackSpeed} times — open settings`}
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

        <style>{`
          @keyframes cog-beat {
            from { transform: scale(1.45); }
            to   { transform: scale(1); }
          }
          .cog-beat-pulse { animation: cog-beat 160ms var(--cog-ease) both; }
          @media (prefers-reduced-motion: reduce) {
            .cog-beat-pulse { animation: none; }
          }
        `}</style>
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
          onToggleMetronome={toggleMetronome}
          onSetBpm={setBpm}
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
  label,
  children,
}: {
  onClick: () => void;
  size: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
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
