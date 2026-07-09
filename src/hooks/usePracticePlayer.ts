import { useCallback, useEffect, useRef, useState } from "react";
import { audioCache } from "@/lib/voice/audioCache";
import { getSignedUrl } from "@/lib/voice/voiceApi";
import { computeNormalizationGain, clearGainCache } from "@/lib/audio/volumeNormalizer";
import {
  updateMediaSession,
  setMediaSessionPlaybackState,
  clearMediaSession,
} from "@/lib/audio/mediaSessionBridge";
import {
  saveSession,
  loadSession,
  clearSession,
  saveLoopMode,
  mergeSessionIntoHistory,
} from "@/lib/audio/practiceStorage";
import {
  masteryFromLoops,
  DEFAULT_SPEED_TRAINER,
  INITIAL_STATS,
  type PracticeSection,
  type PracticePlayerState,
  type LoopMode,
  type SpeedTrainerConfig,
  type PersistedPracticeSession,
} from "@/lib/audio/practiceTypes";
// C4's one metronome engine (the same one Capture and the Canvas consume) —
// practice wires it up, never re-implements the click.
import { Metronome } from "@/lib/audio/metronome";

/** Tempo the click should run at: song bpm scaled by the effective playback
 *  speed, so the metronome tracks the speed trainer as it ramps. */
export function effectiveClickBpm(state: Pick<PracticePlayerState, "bpm" | "playbackSpeed" | "speedTrainer">): number {
  const speed = state.speedTrainer.enabled ? state.speedTrainer.currentSpeed : state.playbackSpeed;
  return Math.round(state.bpm * speed);
}

const DEFAULT_BPM = 100;
const BEATS_PER_BAR = 4;

// ─── Haptics ───────────────────────────────────────────────────────────────

function vibrate(pattern: number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

const HAPTIC_LOOP_COMPLETE   = [15];
const HAPTIC_SECTION_CHANGE  = [15, 50, 15];
const HAPTIC_DRIVE_ACTIVATE  = [20, 30, 20, 30, 20];
const HAPTIC_PLAY_PAUSE      = [8];

// ─── Initial state ─────────────────────────────────────────────────────────

const buildInitialState = (
  songId: string,
  songTitle: string,
  sections: PracticeSection[],
): PracticePlayerState => ({
  status: sections.length === 0 ? "idle" : "caching",
  driveMode: false,
  sections,
  activeSectionIndex: 0,
  loopMode: "single",
  sequence: [],
  sequencePosition: 0,
  repeatPerSection: 1,
  repeatCountThisPosition: 0,
  loopCount: 0,
  currentPositionMs: 0,
  loopRegion: null,
  playbackSpeed: 1.0,
  gapMs: 500,
  showLyrics: true,
  countInEnabled: false,
  bpm: DEFAULT_BPM,
  bpmFromSong: false,
  metronomeOn: false,
  metronomeBeat: -1,
  songKey: null,
  timerEndTimeMs: null,
  speedTrainer: { ...DEFAULT_SPEED_TRAINER },
  stats: { ...INITIAL_STATS, startTimeMs: Date.now() },
  showSummary: false,
  songTitle,
  songId,
});

// ─── Main hook ────────────────────────────────────────────────────────────

export function usePracticePlayer() {
  const [state, setState] = useState<PracticePlayerState>({
    ...buildInitialState("", "", []),
    status: "idle",
  });

  // Audio pipeline
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceRef   = useRef<MediaElementAudioSourceNode | null>(null);

  // Scheduling
  const gapTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionRafRef = useRef<number | null>(null);

  // Blob URL we created (needs revocation on section change)
  const blobUrlRef = useRef<string | null>(null);

  // Metronome (C4's engine, consumed — never forked). One instance for the
  // running click, one for the count-in bar (countIn is a constructor-bound
  // mode on the engine, so the two jobs get separate instances).
  const metroRef = useRef<Metronome | null>(null);
  const countInMetroRef = useRef<Metronome | null>(null);
  const countInResolveRef = useRef<(() => void) | null>(null);

  // Generation token: bumped by pause/end/section- and take-changes so an
  // in-flight count-in or take-swap that got superseded never plays audio.
  const playGenRef = useRef(0);

  // Stable ref to state so callbacks don't capture stale closures
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // ─── Cleanup helpers ──────────────────────────────────────────────────

  const clearGapTimer = useCallback(() => {
    if (gapTimerRef.current !== null) {
      clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
  }, []);

  const stopPositionRaf = useCallback(() => {
    if (positionRafRef.current !== null) {
      cancelAnimationFrame(positionRafRef.current);
      positionRafRef.current = null;
    }
  }, []);

  const revokeBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // ─── Count-in (C4 metronome in one-bar mode) ──────────────────────────

  /** Silence a pending count-in and release anyone awaiting it. */
  const cancelCountIn = useCallback(() => {
    countInMetroRef.current?.stop();
    countInResolveRef.current?.();
    countInResolveRef.current = null;
  }, []);

  /**
   * Play one bar of clicks at the effective tempo and resolve as the first
   * real downbeat lands — the moment the section should start. Resolves
   * immediately when Web Audio is unavailable so playback never hangs.
   */
  const runCountIn = useCallback(async (): Promise<void> => {
    if (!countInMetroRef.current) {
      countInMetroRef.current = new Metronome({
        bpm: effectiveClickBpm(stateRef.current),
        beatsPerBar: BEATS_PER_BAR,
        countIn: true,
        onCountInDone: () => {
          countInMetroRef.current?.stop();
          countInResolveRef.current?.();
          countInResolveRef.current = null;
        },
      });
    }
    const m = countInMetroRef.current;
    m.setBpm(effectiveClickBpm(stateRef.current));
    const done = new Promise<void>((resolve) => { countInResolveRef.current = resolve; });
    await m.start();
    if (!m.isRunning) {
      // No Web Audio — the engine no-ops rather than throwing; so do we.
      countInResolveRef.current = null;
      return;
    }
    await done;
  }, []);

  // ─── Position tracking ────────────────────────────────────────────────

  const startPositionTracking = useCallback(() => {
    stopPositionRaf();
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        const posMs = audio.currentTime * 1000;
        // A/B loop — wrap the playhead back to the region start the instant it
        // passes the end, so only the drilled window plays. Bumps the loop
        // count + haptic just like a full-section loop.
        const region = stateRef.current.loopRegion;
        if (region && posMs >= region.endMs && audio.duration) {
          audio.currentTime = region.startMs / 1000;
          vibrate(HAPTIC_LOOP_COMPLETE);
          setState(s => ({ ...s, currentPositionMs: region.startMs, loopCount: s.loopCount + 1 }));
        } else {
          setState(s => ({ ...s, currentPositionMs: posMs }));
        }
      }
      positionRafRef.current = requestAnimationFrame(tick);
    };
    positionRafRef.current = requestAnimationFrame(tick);
  }, [stopPositionRaf]);

  // ─── Load and play a section ──────────────────────────────────────────

  const loadAndPlay = useCallback(async (sectionIndex: number) => {
    const s = stateRef.current;
    const section = s.sections[sectionIndex];
    if (!section) return;

    const gen = ++playGenRef.current;
    cancelCountIn();
    clearGapTimer();
    stopPositionRaf();

    // Stop existing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
    }
    revokeBlobUrl();

    if (!section.memoId) {
      setState(prev => ({
        ...prev,
        activeSectionIndex: sectionIndex,
        loopCount: 0,
        currentPositionMs: 0,
        status: "paused",
      }));
      return;
    }

    setState(prev => ({ ...prev, status: "caching", activeSectionIndex: sectionIndex }));

    try {
      // Get from cache first
      let blob = await audioCache.get(section.memoId);
      if (!blob) {
        const url = await getSignedUrl(section.memoId);
        const resp = await fetch(url);
        blob = await resp.blob();
        await audioCache.set(section.memoId, blob);
      }

      // Compute normalization gain
      const gain = await computeNormalizationGain(section.memoId, blob);

      // Build blob URL
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      // Create / reuse AudioContext + GainNode
      let audioCtx = audioCtxRef.current;
      if (!audioCtx || audioCtx.state === "closed") {
        audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
      }
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      // Disconnect old nodes
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch { /* already disconnected */ }
      }
      if (gainNodeRef.current) {
        try { gainNodeRef.current.disconnect(); } catch { /* already disconnected */ }
      }

      // Create new audio element
      const audio = new Audio(blobUrl);
      audio.preload = "auto";
      audioRef.current = audio;

      // Apply speed
      const currentSpeed = s.speedTrainer.enabled
        ? s.speedTrainer.currentSpeed
        : s.playbackSpeed;
      audio.playbackRate = currentSpeed;

      // Wire Web Audio gain
      try {
        const source = audioCtx.createMediaElementSource(audio);
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = gain;
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        sourceRef.current = source;
        gainNodeRef.current = gainNode;
      } catch {
        // Web Audio setup failed — fall back to plain element (no normalization)
      }

      setState(prev => ({
        ...prev,
        status: "playing",
        activeSectionIndex: sectionIndex,
        loopCount: 0,
        currentPositionMs: 0,
      }));

      // One bar of clicks before the section starts (the tray's count-in
      // toggle, finally real). Abort if paused/superseded during the bar.
      if (stateRef.current.countInEnabled) {
        await runCountIn();
        if (gen !== playGenRef.current) return;
      }

      audio.onended = () => handleSectionEnded(sectionIndex);
      await audio.play();
      startPositionTracking();

      // Update lock screen
      const st = stateRef.current;
      updateMediaSession({
        sectionLabel: section.label,
        loopCount: 0,
        songTitle: section.songTitle ?? st.songTitle,
        durationMs: section.durationMs,
        positionMs: 0,
        playbackRate: currentSpeed,
        onPlay:            () => resume(),
        onPause:           () => pause(),
        onPrev:            () => goToPrevSection(),
        onNext:            () => goToNextSection(),
        onRestartCurrent:  () => restartCurrentSection(),
        onPrevSong:        section.songId ? () => goToPrevSong() : undefined,
        onNextSong:        section.songId ? () => goToNextSong() : undefined,
      });
      setMediaSessionPlaybackState("playing");

    } catch {
      setState(prev => ({ ...prev, status: "paused" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearGapTimer, stopPositionRaf, revokeBlobUrl, startPositionTracking, cancelCountIn, runCountIn]);

  // ─── Loop scheduling ──────────────────────────────────────────────────

  const handleSectionEnded = useCallback((sectionIndex: number) => {
    const s = stateRef.current;
    const section = s.sections[sectionIndex];
    if (!section) return;

    // Increment loop count for this section
    const newLoopCount = s.loopCount + 1;

    // Update stats
    const sectionLoops = (s.stats.loopsPerSection[section.id] ?? 0) + 1;
    const newStats = {
      ...s.stats,
      loopsPerSection: { ...s.stats.loopsPerSection, [section.id]: sectionLoops },
    };

    // Speed trainer advancement
    let newSpeedTrainer = s.speedTrainer;
    if (s.speedTrainer.enabled) {
      const newLoopsAtSpeed = s.speedTrainer.loopsAtCurrentSpeed + 1;
      if (
        newLoopsAtSpeed >= s.speedTrainer.loopsPerStep &&
        s.speedTrainer.currentSpeed < s.speedTrainer.targetSpeed
      ) {
        const nextSpeed = Math.min(
          Math.round((s.speedTrainer.currentSpeed + 0.1) * 10) / 10,
          s.speedTrainer.targetSpeed,
        );
        newSpeedTrainer = { ...s.speedTrainer, currentSpeed: nextSpeed, loopsAtCurrentSpeed: 0 };
        if (audioRef.current) audioRef.current.playbackRate = nextSpeed;
      } else {
        newSpeedTrainer = { ...s.speedTrainer, loopsAtCurrentSpeed: newLoopsAtSpeed };
      }
    }

    // Update mastery level
    const isAtFullSpeed = (s.speedTrainer.enabled ? newSpeedTrainer.currentSpeed : s.playbackSpeed) >= 1.0;
    const fullSpeedLoops = isAtFullSpeed ? 1 : 0;
    const updatedSections = s.sections.map((sec, i) => {
      if (i !== sectionIndex) return sec;
      const newSessionLoops = sec.loopCountThisSession + 1;
      return {
        ...sec,
        loopCountThisSession: newSessionLoops,
        masteryLevel: masteryFromLoops(sec.masteryLevel === "mastered" ? 30 : fullSpeedLoops),
      };
    });

    setState(prev => ({
      ...prev,
      loopCount: newLoopCount,
      stats: newStats,
      speedTrainer: newSpeedTrainer,
      sections: updatedSections,
    }));

    vibrate(HAPTIC_LOOP_COMPLETE);

    // Update lock screen loop count
    updateMediaSession({
      sectionLabel: section.label,
      loopCount: newLoopCount,
      songTitle: section.songTitle ?? s.songTitle,
      durationMs: section.durationMs,
      positionMs: 0,
      playbackRate: s.speedTrainer.enabled ? newSpeedTrainer.currentSpeed : s.playbackSpeed,
      onPlay:           () => resume(),
      onPause:          () => pause(),
      onPrev:           () => goToPrevSection(),
      onNext:           () => goToNextSection(),
      onRestartCurrent: () => restartCurrentSection(),
      onPrevSong:       section.songId ? () => goToPrevSong() : undefined,
      onNextSong:       section.songId ? () => goToNextSong() : undefined,
    });

    // Determine what plays next
    const scheduleNext = (nextIndex: number, nextLoopCount: number) => {
      gapTimerRef.current = setTimeout(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = 0;
        if (nextIndex !== sectionIndex) {
          loadAndPlay(nextIndex);
        } else {
          const restart = () => {
            audio.play().catch(() => {});
            setState(prev => ({
              ...prev,
              loopCount: nextLoopCount,
              currentPositionMs: 0,
            }));
            audio.onended = () => handleSectionEnded(nextIndex);
          };
          // "1-bar count before each loop": the same-section restart counts
          // in too, aborting if the user paused during the bar.
          if (stateRef.current.countInEnabled) {
            const gen = playGenRef.current;
            void runCountIn().then(() => {
              if (gen === playGenRef.current && stateRef.current.status === "playing") restart();
            });
          } else {
            restart();
          }
        }
      }, s.gapMs);
    };

    const { loopMode, sequence, sequencePosition, repeatPerSection, repeatCountThisPosition } = s;

    if (loopMode === "single") {
      scheduleNext(sectionIndex, newLoopCount);
    } else if (loopMode === "sequence" && sequence.length > 0) {
      const newRepeatCount = repeatCountThisPosition + 1;
      if (newRepeatCount >= repeatPerSection) {
        const nextPos = (sequencePosition + 1) % sequence.length;
        setState(prev => ({
          ...prev,
          sequencePosition: nextPos,
          repeatCountThisPosition: 0,
        }));
        vibrate(HAPTIC_SECTION_CHANGE);
        gapTimerRef.current = setTimeout(() => loadAndPlay(sequence[nextPos]), s.gapMs);
      } else {
        setState(prev => ({ ...prev, repeatCountThisPosition: newRepeatCount }));
        scheduleNext(sectionIndex, newLoopCount);
      }
    } else if (loopMode === "all") {
      const nextIdx = (sectionIndex + 1) % s.sections.length;
      if (nextIdx !== sectionIndex) vibrate(HAPTIC_SECTION_CHANGE);
      gapTimerRef.current = setTimeout(() => loadAndPlay(nextIdx), s.gapMs);
    } else if (loopMode === "run-through") {
      const nextIdx = sectionIndex + 1;
      if (nextIdx < s.sections.length) {
        vibrate(HAPTIC_SECTION_CHANGE);
        gapTimerRef.current = setTimeout(() => loadAndPlay(nextIdx), s.gapMs);
      } else {
        // Run through complete
        setState(prev => ({
          ...prev,
          status: "ended",
          stats: { ...newStats, fullRunThroughs: prev.stats.fullRunThroughs + 1 },
          showSummary: true,
        }));
        setMediaSessionPlaybackState("none");
      }
    }
  // handleSectionEnded forward-references itself so keep the deps stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAndPlay]);

  // ─── Timer enforcement ────────────────────────────────────────────────

  useEffect(() => {
    if (!state.timerEndTimeMs || state.status !== "playing") return;
    const remaining = state.timerEndTimeMs - Date.now();
    if (remaining <= 0) {
      endSession();
      return;
    }
    const id = setTimeout(() => endSession(), remaining);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.timerEndTimeMs, state.status]);

  // ─── Pre-cache all memos on session start ─────────────────────────────

  const preCacheAll = useCallback(async (sections: PracticeSection[]) => {
    const withMemos = sections.filter(s => s.memoId);

    await Promise.all(
      withMemos.map(async (section) => {
        if (!section.memoId) return;
        setState(prev => ({
          ...prev,
          sections: prev.sections.map(s =>
            s.id === section.id ? { ...s, cacheStatus: "caching" } : s,
          ),
        }));
        try {
          const existing = await audioCache.get(section.memoId);
          if (!existing) {
            const url = await getSignedUrl(section.memoId);
            const resp = await fetch(url);
            const blob = await resp.blob();
            await audioCache.set(section.memoId, blob);
          }
          setState(prev => ({
            ...prev,
            sections: prev.sections.map(s =>
              s.id === section.id ? { ...s, cacheStatus: "cached" } : s,
            ),
          }));
        } catch {
          setState(prev => ({
            ...prev,
            sections: prev.sections.map(s =>
              s.id === section.id ? { ...s, cacheStatus: "failed" } : s,
            ),
          }));
        }
      }),
    );
  }, []);

  // ─── Public API ───────────────────────────────────────────────────────

  const initSession = useCallback(async (
    songId: string,
    songTitle: string,
    sections: PracticeSection[],
    resumeSession?: PersistedPracticeSession,
    meta?: { bpm?: number | null; songKey?: string | null },
  ) => {
    const initial = buildInitialState(songId, songTitle, sections);

    if (resumeSession) {
      initial.activeSectionIndex = resumeSession.activeSectionIndex;
      initial.loopMode = resumeSession.loopMode;
      initial.sequence = resumeSession.sequence;
      initial.playbackSpeed = resumeSession.playbackSpeed;
      initial.driveMode = resumeSession.driveMode;
    }

    if (meta?.bpm != null) {
      initial.bpm = meta.bpm;
      initial.bpmFromSong = true;
    }
    if (meta?.songKey) initial.songKey = meta.songKey;

    setState(initial);

    // Pre-cache
    await preCacheAll(sections);

    setState(prev => ({ ...prev, status: "ready" }));
  }, [preCacheAll]);

  /**
   * Merge the full practice bundle (takes per section, chord lines from C3's
   * sheet, tempo/key) into a session that started from lighter nav-state
   * sections (the canvas fast path). Never touches active playback: takes are
   * only grafted onto sections that don't have any yet, and the live section's
   * mirrored fields are left alone.
   */
  const applyEnrichment = useCallback((
    songId: string,
    sections: PracticeSection[],
    meta?: { bpm?: number | null; songKey?: string | null },
  ) => {
    setState(prev => {
      if (prev.songId !== songId) return prev;
      const byId = new Map(sections.map(s => [s.id, s]));
      return {
        ...prev,
        bpm: !prev.bpmFromSong && meta?.bpm != null ? meta.bpm : prev.bpm,
        bpmFromSong: prev.bpmFromSong || meta?.bpm != null,
        songKey: prev.songKey ?? meta?.songKey ?? null,
        sections: prev.sections.map(sec => {
          const enriched = byId.get(sec.id);
          if (!enriched) return sec;
          const next: PracticeSection = {
            ...sec,
            chordLines: sec.chordLines ?? enriched.chordLines ?? null,
          };
          if ((!sec.takes || sec.takes.length === 0) && enriched.takes && enriched.takes.length > 0) {
            const idx = enriched.takes.findIndex(t => t.memoId === sec.memoId);
            if (idx >= 0) {
              next.takes = enriched.takes;
              next.activeTakeIndex = idx;
            } else if (sec.memoId) {
              // The playing memo isn't in the loaded takes (filtered status
              // etc.) — keep it as its own take so the mirror stays honest.
              next.takes = [
                { memoId: sec.memoId, label: "Current take", durationMs: sec.durationMs, lyrics: sec.lyrics, transcriptLines: sec.transcriptLines },
                ...enriched.takes,
              ];
              next.activeTakeIndex = 0;
            } else {
              next.takes = enriched.takes;
              next.activeTakeIndex = 0;
            }
          }
          return next;
        }),
      };
    });
  }, []);

  const play = useCallback(() => {
    const s = stateRef.current;
    if (s.status === "ready" || s.status === "paused") {
      if (!audioRef.current || audioRef.current.ended) {
        loadAndPlay(s.activeSectionIndex);
      } else {
        audioRef.current.play().catch(() => {});
        setState(prev => ({ ...prev, status: "playing" }));
        startPositionTracking();
        setMediaSessionPlaybackState("playing");
      }
    }
    vibrate(HAPTIC_PLAY_PAUSE);
  }, [loadAndPlay, startPositionTracking]);

  const pause = useCallback(() => {
    playGenRef.current++; // invalidate a pending count-in / loop restart
    cancelCountIn();
    clearGapTimer();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    stopPositionRaf();
    setState(prev => ({ ...prev, status: "paused" }));
    setMediaSessionPlaybackState("paused");
    vibrate(HAPTIC_PLAY_PAUSE);

    // Persist session
    const s = stateRef.current;
    saveSession({
      songId: s.songId,
      activeSectionIndex: s.activeSectionIndex,
      loopMode: s.loopMode,
      sequence: s.sequence,
      playbackSpeed: s.playbackSpeed,
      driveMode: s.driveMode,
      savedAt: new Date().toISOString(),
      title: s.songTitle,
      sectionLabel: s.sections[s.activeSectionIndex]?.label,
      loopCount: s.loopCount,
    });
  }, [clearGapTimer, stopPositionRaf, cancelCountIn]);

  const resume = useCallback(() => play(), [play]);

  const goToSection = useCallback((index: number) => {
    vibrate(HAPTIC_SECTION_CHANGE);
    // A/B loop belongs to the section it was drawn on — clear it on any move.
    setState(prev => ({ ...prev, loopCount: 0, sequencePosition: 0, repeatCountThisPosition: 0, loopRegion: null }));
    loadAndPlay(index);
  }, [loadAndPlay]);

  const goToNextSection = useCallback(() => {
    const s = stateRef.current;
    let next: number;
    if (s.loopMode === "sequence" && s.sequence.length > 0) {
      const nextPos = (s.sequencePosition + 1) % s.sequence.length;
      next = s.sequence[nextPos];
      setState(prev => ({ ...prev, sequencePosition: nextPos, repeatCountThisPosition: 0 }));
    } else {
      next = (s.activeSectionIndex + 1) % s.sections.length;
    }
    goToSection(next);
  }, [goToSection]);

  const goToPrevSection = useCallback(() => {
    const s = stateRef.current;
    let prev: number;
    if (s.loopMode === "sequence" && s.sequence.length > 0) {
      const prevPos = (s.sequencePosition - 1 + s.sequence.length) % s.sequence.length;
      prev = s.sequence[prevPos];
      setState(st => ({ ...st, sequencePosition: prevPos, repeatCountThisPosition: 0 }));
    } else {
      prev = (s.activeSectionIndex - 1 + s.sections.length) % s.sections.length;
    }
    goToSection(prev);
  }, [goToSection]);

  // ─── Album song-level navigation ──────────────────────────────────────
  // Album sessions flatten every song's sections in order; each section carries
  // its songId, so a song is a contiguous block. Skip to the next/previous
  // block's first section — the "this song's solid, next song" car gesture.

  const goToNextSong = useCallback(() => {
    const s = stateRef.current;
    const secs = s.sections;
    const cur = secs[s.activeSectionIndex]?.songId;
    if (!cur) return; // not an album session
    for (let step = 1; step <= secs.length; step++) {
      const idx = (s.activeSectionIndex + step) % secs.length;
      const sid = secs[idx]?.songId;
      if (sid && sid !== cur) { goToSection(idx); return; }
    }
  }, [goToSection]);

  const goToPrevSong = useCallback(() => {
    const s = stateRef.current;
    const secs = s.sections;
    const cur = secs[s.activeSectionIndex]?.songId;
    if (!cur) return;
    // Start of the current song block.
    let start = s.activeSectionIndex;
    while (start > 0 && secs[start - 1]?.songId === cur) start--;
    // Apple behavior: if we're past the start, restart the current song first.
    if (s.activeSectionIndex > start) { goToSection(start); return; }
    // Otherwise jump to the start of the previous song (wrap to last).
    const prevEnd = start === 0 ? secs.length - 1 : start - 1;
    const prevSong = secs[prevEnd]?.songId;
    let prevStart = prevEnd;
    while (prevStart > 0 && secs[prevStart - 1]?.songId === prevSong) prevStart--;
    goToSection(prevStart);
  }, [goToSection]);

  const restartCurrentSection = useCallback(() => {
    const audio = audioRef.current;
    // With an A/B loop set, "restart" means restart the drilled window.
    const startMs = stateRef.current.loopRegion?.startMs ?? 0;
    if (audio) {
      audio.currentTime = startMs / 1000;
      if (stateRef.current.status === "playing") {
        audio.play().catch(() => {});
      }
    }
    setState(prev => ({ ...prev, currentPositionMs: startMs }));
  }, []);

  /** Set or clear the A/B loop window (milliseconds within the current section). */
  const setLoopRegion = useCallback((region: { startMs: number; endMs: number } | null) => {
    setState(prev => ({ ...prev, loopRegion: region }));
    // Jump the playhead to the window start so the drill begins immediately.
    if (region && audioRef.current) {
      audioRef.current.currentTime = region.startMs / 1000;
    }
  }, []);

  // ─── Take-swiping (F15 — consume C4's memo/take model) ────────────────

  /**
   * Switch a section to another of its takes. For the active section the
   * audio source is swapped mid-session while loop mode, loop counts, speed,
   * and (clamped) position are preserved — rehearsal flow is never broken.
   * Sections with one take are untouched by definition.
   */
  const setActiveTake = useCallback(async (sectionIndex: number, takeIndex: number) => {
    const s = stateRef.current;
    const section = s.sections[sectionIndex];
    const takes = section?.takes;
    if (!section || !takes || takeIndex < 0 || takeIndex >= takes.length) return;
    if ((section.activeTakeIndex ?? 0) === takeIndex) return;
    const take = takes[takeIndex];

    const mirror = (sec: PracticeSection): PracticeSection => ({
      ...sec,
      memoId: take.memoId,
      durationMs: take.durationMs,
      lyrics: take.lyrics,
      transcriptLines: take.transcriptLines,
      activeTakeIndex: takeIndex,
    });

    // Inactive section — re-point it; audio loads whenever it's entered.
    if (sectionIndex !== s.activeSectionIndex) {
      setState(prev => ({
        ...prev,
        sections: prev.sections.map((sec, i) => (i === sectionIndex ? mirror(sec) : sec)),
      }));
      return;
    }

    // Active section: swap the source under the engine without disturbing it.
    const wasPlaying = s.status === "playing";
    const prevPositionMs = s.currentPositionMs;
    const gen = ++playGenRef.current; // supersede pending count-ins/loads
    cancelCountIn();
    clearGapTimer();
    stopPositionRaf();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
    }
    revokeBlobUrl();

    setState(prev => ({
      ...prev,
      status: "caching",
      sections: prev.sections.map((sec, i) => (i === sectionIndex ? mirror(sec) : sec)),
      // An A/B window drawn on the old take is kept only if the new take is
      // long enough for it — a half-valid drill window would loop garbage.
      loopRegion:
        prev.loopRegion && take.durationMs > 0 && prev.loopRegion.endMs <= take.durationMs
          ? prev.loopRegion
          : null,
    }));

    try {
      let blob = await audioCache.get(take.memoId);
      if (!blob) {
        const url = await getSignedUrl(take.memoId);
        const resp = await fetch(url);
        blob = await resp.blob();
        await audioCache.set(take.memoId, blob);
      }
      if (gen !== playGenRef.current) return;

      const gain = await computeNormalizationGain(take.memoId, blob);
      if (gen !== playGenRef.current) return;

      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      let audioCtx = audioCtxRef.current;
      if (!audioCtx || audioCtx.state === "closed") {
        audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
      }
      if (audioCtx.state === "suspended") await audioCtx.resume();

      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch { /* already disconnected */ }
      }
      if (gainNodeRef.current) {
        try { gainNodeRef.current.disconnect(); } catch { /* already disconnected */ }
      }

      const audio = new Audio(blobUrl);
      audio.preload = "auto";
      audioRef.current = audio;

      const st = stateRef.current;
      audio.playbackRate = st.speedTrainer.enabled ? st.speedTrainer.currentSpeed : st.playbackSpeed;

      try {
        const source = audioCtx.createMediaElementSource(audio);
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = gain;
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        sourceRef.current = source;
        gainNodeRef.current = gainNode;
      } catch {
        // Web Audio setup failed — plain element fallback (no normalization)
      }

      // Same musical spot in the new take, clamped so we never land past its
      // end (which would fire onended instantly and skip a loop).
      const resumeMs =
        take.durationMs > 0 ? Math.min(prevPositionMs, Math.max(0, take.durationMs - 250)) : 0;
      audio.currentTime = resumeMs / 1000;
      audio.onended = () => handleSectionEnded(sectionIndex);

      setState(prev => ({
        ...prev,
        status: wasPlaying ? "playing" : "paused",
        currentPositionMs: resumeMs,
      }));

      if (wasPlaying) {
        await audio.play();
        startPositionTracking();
      }
      vibrate(HAPTIC_SECTION_CHANGE);

      updateMediaSession({
        sectionLabel: `${section.label} · ${take.label}`,
        loopCount: stateRef.current.loopCount,
        songTitle: section.songTitle ?? stateRef.current.songTitle,
        durationMs: take.durationMs,
        positionMs: resumeMs,
        playbackRate: audio.playbackRate,
        onPlay:           () => resume(),
        onPause:          () => pause(),
        onPrev:           () => goToPrevSection(),
        onNext:           () => goToNextSection(),
        onRestartCurrent: () => restartCurrentSection(),
      });
      if (wasPlaying) setMediaSessionPlaybackState("playing");
    } catch {
      if (gen === playGenRef.current) {
        setState(prev => ({ ...prev, status: "paused" }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelCountIn, clearGapTimer, stopPositionRaf, revokeBlobUrl, startPositionTracking]);

  const setLoopMode = useCallback((mode: LoopMode) => {
    setState(prev => ({ ...prev, loopMode: mode, sequencePosition: 0, repeatCountThisPosition: 0, loopCount: 0 }));
    saveLoopMode(stateRef.current.songId, mode);
  }, []);

  const toggleDriveMode = useCallback(() => {
    const next = !stateRef.current.driveMode;
    if (next) vibrate(HAPTIC_DRIVE_ACTIVATE);
    setState(prev => ({ ...prev, driveMode: next }));
  }, []);

  const setSequence = useCallback((indices: number[]) => {
    setState(prev => ({ ...prev, sequence: indices, sequencePosition: 0, repeatCountThisPosition: 0 }));
  }, []);

  const setPlaybackSpeed = useCallback((speed: number) => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
    setState(prev => ({ ...prev, playbackSpeed: speed }));
  }, []);

  const setGapMs = useCallback((gap: 0 | 500 | 1000 | 2000) => {
    setState(prev => ({ ...prev, gapMs: gap }));
  }, []);

  const setShowLyrics = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showLyrics: show }));
  }, []);

  const setCountInEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, countInEnabled: enabled }));
  }, []);

  // ─── Metronome (F14 in practice — consume C4's engine) ────────────────

  /**
   * One-tap click at the song tempo. Independent of playback like a physical
   * metronome (pause the take, keep the click, practice a cappella); the
   * tempo-tracking effect below keeps it locked to the speed trainer.
   * Must be called from a user gesture (it resumes the AudioContext).
   */
  const toggleMetronome = useCallback(() => {
    const s = stateRef.current;
    if (s.metronomeOn) {
      metroRef.current?.stop();
      setState(prev => ({ ...prev, metronomeOn: false, metronomeBeat: -1 }));
      return;
    }
    if (!metroRef.current) {
      metroRef.current = new Metronome({
        bpm: effectiveClickBpm(s),
        beatsPerBar: BEATS_PER_BAR,
        onBeat: (beat) => setState(prev => (prev.metronomeOn ? { ...prev, metronomeBeat: beat } : prev)),
      });
    }
    metroRef.current.setBpm(effectiveClickBpm(s));
    setState(prev => ({ ...prev, metronomeOn: true }));
    void metroRef.current.start();
  }, []);

  const setBpm = useCallback((bpm: number) => {
    const clamped = Math.max(40, Math.min(240, Math.round(bpm)));
    if (!Number.isFinite(clamped)) return;
    setState(prev => ({ ...prev, bpm: clamped }));
  }, []);

  // The click follows the music: song bpm × effective playback speed, live —
  // when the speed trainer steps 0.7×→0.8×, the very next interval clicks at
  // the new tempo (C4's setBpm is glitch-free by design).
  useEffect(() => {
    if (!state.metronomeOn) return;
    metroRef.current?.setBpm(effectiveClickBpm(state));
  }, [state.metronomeOn, state.bpm, state.playbackSpeed, state.speedTrainer.enabled, state.speedTrainer.currentSpeed, state]);

  const setRepeatPerSection = useCallback((count: 1 | 2 | 3) => {
    setState(prev => ({ ...prev, repeatPerSection: count }));
  }, []);

  const setTimerEndTimeMs = useCallback((time: number | null) => {
    setState(prev => ({ ...prev, timerEndTimeMs: time }));
  }, []);

  const setSpeedTrainer = useCallback((patch: Partial<SpeedTrainerConfig>) => {
    setState(prev => ({
      ...prev,
      speedTrainer: { ...prev.speedTrainer, ...patch },
    }));
  }, []);

  const dismissSummary = useCallback(() => {
    setState(prev => ({ ...prev, showSummary: false }));
  }, []);

  const endSession = useCallback(() => {
    playGenRef.current++;
    cancelCountIn();
    metroRef.current?.stop();
    clearGapTimer();
    stopPositionRaf();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
    }
    revokeBlobUrl();
    clearGainCache();
    clearMediaSession();

    const s = stateRef.current;

    // Merge into persistent history
    const sessionMinutes = (Date.now() - s.stats.startTimeMs) / 60000;
    const loopsMap: Record<string, { label: string; loops: number; atFullSpeed: number }> = {};
    for (const sec of s.sections) {
      if (sec.loopCountThisSession > 0) {
        loopsMap[sec.id] = {
          label: sec.label,
          loops: sec.loopCountThisSession,
          atFullSpeed: s.playbackSpeed >= 1.0 ? sec.loopCountThisSession : 0,
        };
      }
    }
    mergeSessionIntoHistory(s.songId, sessionMinutes, loopsMap);
    clearSession(s.songId);

    setState(prev => ({ ...prev, status: "ended", showSummary: true, metronomeOn: false, metronomeBeat: -1 }));
    setMediaSessionPlaybackState("none");
  }, [clearGapTimer, stopPositionRaf, revokeBlobUrl, cancelCountIn]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────

  useEffect(() => {
    return () => {
      clearGapTimer();
      stopPositionRaf();
      cancelCountIn();
      // Release both metronome AudioContexts — a click must never outlive
      // the provider (C4's dispose() is stop + context close).
      metroRef.current?.dispose();
      metroRef.current = null;
      countInMetroRef.current?.dispose();
      countInMetroRef.current = null;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
      }
      revokeBlobUrl();
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
      clearMediaSession();
    };
  }, [clearGapTimer, stopPositionRaf, revokeBlobUrl, cancelCountIn]);

  return {
    state,
    initSession,
    applyEnrichment,
    play,
    pause,
    resume,
    goToSection,
    setActiveTake,
    toggleMetronome,
    setBpm,
    goToNextSection,
    goToPrevSection,
    goToNextSong,
    goToPrevSong,
    restartCurrentSection,
    setLoopMode,
    setLoopRegion,
    toggleDriveMode,
    setSequence,
    setPlaybackSpeed,
    setGapMs,
    setShowLyrics,
    setCountInEnabled,
    setRepeatPerSection,
    setTimerEndTimeMs,
    setSpeedTrainer,
    dismissSummary,
    endSession,
  };
}

export type PracticePlayerHook = ReturnType<typeof usePracticePlayer>;
