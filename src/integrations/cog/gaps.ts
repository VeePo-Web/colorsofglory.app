/**
 * R35 — "What's still missing"
 *
 * One request tells the room which parts of the song have no words yet and
 * which have never been sung out loud. The room turns that into ONE gentle
 * line, never a checklist and never a badge.
 */
import { supabase } from "@/integrations/supabase/client";

export type GapKind = "empty" | "no_words" | "no_sound" | "complete";

export interface SongGap {
  section_id: string;
  label: string;
  kind: string;
  section_position: number;
  has_words: boolean;
  has_sound: boolean;
  gap: GapKind;
}

export async function fetchSongGaps(songId: string): Promise<SongGap[]> {
  const { data, error } = await (supabase as any).rpc("song_gaps", { _song_id: songId });
  if (error) throw error;
  return (data ?? []) as SongGap[];
}

/** The single next thing worth doing — earliest incomplete part, or null. */
export function nextGap(gaps: SongGap[]): SongGap | null {
  return gaps.find((g) => g.gap !== "complete") ?? null;
}

/** Plain-language line for the room. Never scolding, never a count. */
export function gapLine(gap: SongGap | null): string | null {
  if (!gap) return null;
  switch (gap.gap) {
    case "empty":
      return `${gap.label} is still empty.`;
    case "no_words":
      return `${gap.label} has no words yet.`;
    case "no_sound":
      return `${gap.label} has never been sung out loud.`;
    default:
      return null;
  }
}

/** 0–1 — how much of the song has both words and sound. */
export function songWholeness(gaps: SongGap[]): number {
  if (!gaps.length) return 0;
  return gaps.filter((g) => g.gap === "complete").length / gaps.length;
}
