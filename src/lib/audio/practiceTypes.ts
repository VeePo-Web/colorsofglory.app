/**
 * Practice-domain types. OWNERSHIP (F2×C4 folder-overlap decision, recorded in
 * docs/PRACTICE-CONTRACT.md): this file and practiceStorage.ts live in
 * src/lib/audio/ for historical import stability but are PRACTICE-domain —
 * owned by F2 by exception. C4 owns every other file in this folder.
 */

export type LoopMode = "single" | "sequence" | "all" | "run-through";
export type PlayerStatus = "idle" | "caching" | "ready" | "playing" | "paused" | "ended";
export type CacheStatus = "pending" | "caching" | "cached" | "failed";
export type MasteryLevel = "untouched" | "starting" | "working" | "solid" | "mastered";

export interface TranscriptLine {
  text: string;
  startMs: number;
  endMs: number;
}

/**
 * One playable take of a section — a voice memo attached to that section.
 * Practice consumes C4's memo model read-only: every playable memo on a
 * section is a take the rehearser can swipe between (F15). The per-memo
 * "versions" queue (memo_takes rows) stays in C4's TakeMiniPlayer lane.
 */
export interface PracticeTake {
  memoId: string;
  /** Memo title, or "Take N" by recording order. */
  label: string;
  durationMs: number;
  lyrics: string | null;
  transcriptLines: TranscriptLine[] | null;
}

/** A chord glyph rendered in the song's display key, bonded to a char index. */
export interface PracticeChordGlyph {
  glyph: string;
  /** UTF-16 index in the line's `text` the chord sits over. */
  at: number;
}

/**
 * One lyric line with its chords, pre-rendered from C3's SheetDoc at load
 * time. Practice DISPLAYS these read-only — chord editing lives in C3's
 * sheet editor, never here.
 */
export interface PracticeChordLine {
  text: string;
  chords: PracticeChordGlyph[];
}

export interface PracticeSection {
  id: string;
  label: string;
  memoId: string | null;
  lyrics: string | null;
  transcriptLines: TranscriptLine[] | null;
  durationMs: number;
  cacheStatus: CacheStatus;
  masteryLevel: MasteryLevel;
  loopCountThisSession: number;
  /**
   * Album mode only: the song this section belongs to. Undefined in a
   * single-song session (every section shares one song). When set, the player
   * shows a song eyebrow so a driver hearing sections from several in-progress
   * songs always knows which song is playing.
   */
  songTitle?: string;
  songId?: string;
  /**
   * All playable takes of this section, oldest first (F15 take-swiping).
   * Optional so canvas-launched nav-state sections (which predate takes)
   * keep working — absent/singleton means "one take", the pre-F15 behavior.
   * `memoId`/`durationMs`/`lyrics`/`transcriptLines` above always mirror the
   * ACTIVE take so every existing engine path stays untouched.
   */
  takes?: PracticeTake[];
  /** Index into `takes` of the take currently mirrored into the section. */
  activeTakeIndex?: number;
  /**
   * Lyrics+chords for this section from C3's sheet (label-matched), rendered
   * in the song's display key. null/absent → no sheet → karaoke fallback.
   */
  chordLines?: PracticeChordLine[] | null;
}

export interface SpeedTrainerConfig {
  enabled: boolean;
  baseSpeed: number;
  targetSpeed: number;
  loopsPerStep: number;
  currentSpeed: number;
  loopsAtCurrentSpeed: number;
}

export interface PracticeSessionStats {
  startTimeMs: number;
  loopsPerSection: Record<string, number>;
  fullRunThroughs: number;
}

export interface PracticePlayerState {
  status: PlayerStatus;
  driveMode: boolean;
  sections: PracticeSection[];
  activeSectionIndex: number;
  loopMode: LoopMode;
  sequence: number[];
  sequencePosition: number;
  repeatPerSection: 1 | 2 | 3;
  repeatCountThisPosition: number;
  loopCount: number;
  currentPositionMs: number;
  /**
   * A/B loop — when set, playback loops only this millisecond window of the
   * current section (drill the one hard phrase, not the whole 40s). Cleared
   * whenever the active section changes.
   */
  loopRegion: { startMs: number; endMs: number } | null;
  playbackSpeed: number;
  gapMs: 0 | 500 | 1000 | 2000;
  showLyrics: boolean;
  countInEnabled: boolean;
  /**
   * Song tempo for the metronome, from C3's sheet meta (falling back to a
   * sensible default); user-adjustable in the settings tray. The click always
   * runs at bpm × effective playback speed so it tracks the speed trainer.
   */
  bpm: number;
  /** True while the sheet/song declared a tempo (vs. the 100 default). */
  bpmFromSong: boolean;
  /** User intent: click while playing (the engine stops itself on pause). */
  metronomeOn: boolean;
  /** 0-indexed beat within the bar for the visual pulse; -1 when silent. */
  metronomeBeat: number;
  /** Display key from C3's sheet, for the chord view eyebrow. */
  songKey: string | null;
  timerEndTimeMs: number | null;
  speedTrainer: SpeedTrainerConfig;
  stats: PracticeSessionStats;
  showSummary: boolean;
  songTitle: string;
  songId: string;
}

export interface PersistedPracticeSession {
  songId: string;
  activeSectionIndex: number;
  loopMode: LoopMode;
  sequence: number[];
  playbackSpeed: number;
  driveMode: boolean;
  savedAt: string;
  /**
   * Human label for a "Resume practice" card — the song/album name, the
   * section left off on, and its loop count. Optional so older saved sessions
   * still parse. `songId` starting with `album:` marks an album session.
   */
  title?: string;
  sectionLabel?: string;
  loopCount?: number;
}

export function masteryFromLoops(loopsAtFullSpeed: number): MasteryLevel {
  if (loopsAtFullSpeed === 0) return "untouched";
  if (loopsAtFullSpeed < 5)  return "starting";
  if (loopsAtFullSpeed < 15) return "working";
  if (loopsAtFullSpeed < 30) return "solid";
  return "mastered";
}

export const DEFAULT_SPEED_TRAINER: SpeedTrainerConfig = {
  enabled: false,
  baseSpeed: 0.75,
  targetSpeed: 1.0,
  loopsPerStep: 5,
  currentSpeed: 0.75,
  loopsAtCurrentSpeed: 0,
};

export const INITIAL_STATS: PracticeSessionStats = {
  startTimeMs: 0,
  loopsPerSection: {},
  fullRunThroughs: 0,
};
