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
  playbackSpeed: 1.0,
  gapMs: 500,
  showLyrics: true,
  countInEnabled: false,
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

  // ─── Position tracking ────────────────────────────────────────────────

  const startPositionTracking = useCallback(() => {
    stopPositionRaf();
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        setState(s => ({ ...s, currentPositionMs: audio.currentTime * 1000 }));
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

      audio.onended = () => handleSectionEnded(sectionIndex);
      await audio.play();
      startPositionTracking();

      // Update lock screen
      const st = stateRef.current;
      updateMediaSession({
        sectionLabel: section.label,
        loopCount: 0,
        songTitle: st.songTitle,
        durationMs: section.durationMs,
        positionMs: 0,
        playbackRate: currentSpeed,
        onPlay:            () => resume(),
        onPause:           () => pause(),
        onPrev:            () => goToPrevSection(),
        onNext:            () => goToNextSection(),
        onRestartCurrent:  () => restartCurrentSection(),
      });
      setMediaSessionPlaybackState("playing");

    } catch {
      setState(prev => ({ ...prev, status: "paused" }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearGapTimer, stopPositionRaf, revokeBlobUrl, startPositionTracking]);

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
      songTitle: s.songTitle,
      durationMs: section.durationMs,
      positionMs: 0,
      playbackRate: s.speedTrainer.enabled ? newSpeedTrainer.currentSpeed : s.playbackSpeed,
      onPlay:           () => resume(),
      onPause:          () => pause(),
      onPrev:           () => goToPrevSection(),
      onNext:           () => goToNextSection(),
      onRestartCurrent: () => restartCurrentSection(),
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
          audio.play().catch(() => {});
          setState(prev => ({
            ...prev,
            loopCount: nextLoopCount,
            currentPositionMs: 0,
          }));
          audio.onended = () => handleSectionEnded(nextIndex);
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
  ) => {
    const initial = buildInitialState(songId, songTitle, sections);

    if (resumeSession) {
      initial.activeSectionIndex = resumeSession.activeSectionIndex;
      initial.loopMode = resumeSession.loopMode;
      initial.sequence = resumeSession.sequence;
      initial.playbackSpeed = resumeSession.playbackSpeed;
      initial.driveMode = resumeSession.driveMode;
    }

    setState(initial);

    // Pre-cache
    await preCacheAll(sections);

    setState(prev => ({ ...prev, status: "ready" }));
  }, [preCacheAll]);

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
    });
  }, [clearGapTimer, stopPositionRaf]);

  const resume = useCallback(() => play(), [play]);

  const goToSection = useCallback((index: number) => {
    vibrate(HAPTIC_SECTION_CHANGE);
    setState(prev => ({ ...prev, loopCount: 0, sequencePosition: 0, repeatCountThisPosition: 0 }));
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

  const restartCurrentSection = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      if (stateRef.current.status === "playing") {
        audio.play().catch(() => {});
      }
    }
    setState(prev => ({ ...prev, currentPositionMs: 0 }));
  }, []);

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

    setState(prev => ({ ...prev, status: "ended", showSummary: true }));
    setMediaSessionPlaybackState("none");
  }, [clearGapTimer, stopPositionRaf, revokeBlobUrl]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────

  useEffect(() => {
    return () => {
      clearGapTimer();
      stopPositionRaf();
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
  }, [clearGapTimer, stopPositionRaf, revokeBlobUrl]);

  return {
    state,
    initSession,
    play,
    pause,
    resume,
    goToSection,
    goToNextSection,
    goToPrevSection,
    restartCurrentSection,
    setLoopMode,
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
