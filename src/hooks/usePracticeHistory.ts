import { useState, useCallback } from "react";
import {
  loadHistory,
  type SongHistory,
  type SectionHistory,
} from "@/lib/audio/practiceStorage";
import { masteryFromLoops } from "@/lib/audio/practiceTypes";
import type { MasteryLevel } from "@/lib/audio/practiceTypes";

export interface SectionMasteryInfo {
  sectionId: string;
  label: string;
  masteryLevel: MasteryLevel;
  totalLoops: number;
  loopsAtFullSpeed: number;
  totalSessions: number;
  lastPracticed: string | null;
}

export interface SongPracticeHistory {
  songId: string;
  totalSessions: number;
  totalMinutesAllTime: number;
  sections: SectionMasteryInfo[];
}

function toMasteryInfo(
  sectionId: string,
  data: SectionHistory,
): SectionMasteryInfo {
  return {
    sectionId,
    label: data.label,
    masteryLevel: masteryFromLoops(data.loopsAtFullSpeed),
    totalLoops: data.totalLoops,
    loopsAtFullSpeed: data.loopsAtFullSpeed,
    totalSessions: data.totalSessions,
    lastPracticed: data.lastPracticed,
  };
}

function toSongHistory(raw: SongHistory): SongPracticeHistory {
  return {
    songId: raw.songId,
    totalSessions: raw.totalSessions,
    totalMinutesAllTime: raw.totalMinutesAllTime,
    sections: Object.entries(raw.sections).map(([id, data]) => toMasteryInfo(id, data)),
  };
}

export function usePracticeHistory(songId: string | undefined) {
  const [history, setHistory] = useState<SongPracticeHistory | null>(() => {
    if (!songId) return null;
    const raw = loadHistory(songId);
    return toSongHistory(raw);
  });

  const refresh = useCallback(() => {
    if (!songId) return;
    const raw = loadHistory(songId);
    setHistory(toSongHistory(raw));
  }, [songId]);

  return { history, refresh };
}
