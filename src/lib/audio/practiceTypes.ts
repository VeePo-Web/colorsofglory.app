export type LoopMode = "single" | "sequence" | "all" | "run-through";
export type PlayerStatus = "idle" | "caching" | "ready" | "playing" | "paused" | "ended";
export type CacheStatus = "pending" | "caching" | "cached" | "failed";
export type MasteryLevel = "untouched" | "starting" | "working" | "solid" | "mastered";

export interface TranscriptLine {
  text: string;
  startMs: number;
  endMs: number;
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
  playbackSpeed: number;
  gapMs: 0 | 500 | 1000 | 2000;
  showLyrics: boolean;
  countInEnabled: boolean;
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
