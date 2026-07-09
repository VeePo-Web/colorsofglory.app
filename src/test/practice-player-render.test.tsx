import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FullPracticePlayer } from "@/components/practice/FullPracticePlayer";
import type { PracticePlayerHook } from "@/hooks/usePracticePlayer";
import type { PracticePlayerState, PracticeSection } from "@/lib/audio/practiceTypes";
import { DEFAULT_SPEED_TRAINER, INITIAL_STATS } from "@/lib/audio/practiceTypes";

/**
 * F2 render coverage: the full player with the three new surfaces live at
 * once — chord chart (C3), take swiper (F15), metronome chip (F14). Verifies
 * the launch-ready wiring without audio (jsdom has no Web Audio; the engine
 * no-ops by design).
 */

const section: PracticeSection = {
  id: "s1",
  label: "Chorus",
  memoId: "m1",
  lyrics: "Amazing grace how sweet",
  transcriptLines: null,
  durationMs: 20000,
  cacheStatus: "cached",
  masteryLevel: "working",
  loopCountThisSession: 2,
  takes: [
    { memoId: "m1", label: "Take 1", durationMs: 20000, lyrics: null, transcriptLines: null },
    { memoId: "m2", label: "Falsetto idea", durationMs: 18000, lyrics: null, transcriptLines: null },
  ],
  activeTakeIndex: 0,
  chordLines: [
    { text: "Amazing grace how sweet", chords: [{ glyph: "G", at: 0 }, { glyph: "C", at: 8 }, { glyph: "D", at: 18 }] },
    { text: "the sound that saved", chords: [{ glyph: "Em", at: 0 }] },
  ],
};

const state: PracticePlayerState = {
  status: "playing",
  driveMode: false,
  sections: [section],
  activeSectionIndex: 0,
  loopMode: "single",
  sequence: [],
  sequencePosition: 0,
  repeatPerSection: 1,
  repeatCountThisPosition: 0,
  loopCount: 3,
  currentPositionMs: 5000,
  loopRegion: null,
  playbackSpeed: 1.0,
  gapMs: 500,
  showLyrics: true,
  countInEnabled: false,
  bpm: 120,
  bpmFromSong: true,
  metronomeOn: true,
  metronomeBeat: 0,
  songKey: "G",
  timerEndTimeMs: null,
  speedTrainer: { ...DEFAULT_SPEED_TRAINER, enabled: true, currentSpeed: 0.8 },
  stats: { ...INITIAL_STATS },
  showSummary: false,
  songTitle: "Grace in the Waiting",
  songId: "song-1",
};

function makeHook(): PracticePlayerHook {
  const noop = vi.fn();
  return {
    state,
    initSession: vi.fn(), applyEnrichment: vi.fn(),
    play: noop, pause: noop, resume: noop,
    goToSection: noop, setActiveTake: vi.fn(), toggleMetronome: vi.fn(), setBpm: vi.fn(),
    goToNextSection: noop, goToPrevSection: noop, goToNextSong: noop, goToPrevSong: noop,
    restartCurrentSection: noop, setLoopMode: noop, setLoopRegion: noop, toggleDriveMode: noop,
    setSequence: noop, setPlaybackSpeed: noop, setGapMs: noop, setShowLyrics: noop,
    setCountInEnabled: noop, setRepeatPerSection: noop, setTimerEndTimeMs: noop,
    setSpeedTrainer: noop, dismissSummary: noop, endSession: noop,
  } as unknown as PracticePlayerHook;
}

describe("FullPracticePlayer — chords + takes + metronome live together", () => {
  it("renders the chord chart with chords over the lyric line and the key eyebrow", () => {
    render(<FullPracticePlayer hook={makeHook()} onClose={() => {}} />);
    expect(screen.getByText("Key of G")).toBeInTheDocument();
    // Chord glyphs from C3 render read-only above the words.
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.getByText("Em")).toBeInTheDocument();
    // No chord-editing affordance exists on this surface.
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows the take swiper and switches takes on tap", () => {
    const hook = makeHook();
    render(<FullPracticePlayer hook={hook} onClose={() => {}} />);
    expect(screen.getByText("Take 1")).toBeInTheDocument();
    expect(screen.getByText("Take 1 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next take" }));
    expect(hook.setActiveTake).toHaveBeenCalledWith(0, 1);
    // At the first take, "previous" is disabled — no wrap-around surprises.
    expect(screen.getByRole("button", { name: "Previous take" })).toBeDisabled();
  });

  it("shows the metronome chip at the trainer-scaled tempo and toggles it", () => {
    const hook = makeHook();
    render(<FullPracticePlayer hook={hook} onClose={() => {}} />);
    // 120 bpm × 0.8 trainer speed = 96 — the click tracks the trainer.
    const chip = screen.getByRole("button", { name: "Turn metronome off" });
    expect(chip).toHaveTextContent("96 bpm");
    fireEvent.click(chip);
    expect(hook.toggleMetronome).toHaveBeenCalled();
  });

  it("keeps the whole transport keyboard-reachable and labeled", () => {
    render(<FullPracticePlayer hook={makeHook()} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart section" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Practice settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close practice player" })).toBeInTheDocument();
  });
});
