/**
 * R36 — "Sing it"
 *
 * One request returns everything needed to sing the song from the phone on a
 * music stand: key, tempo, every part in order, lines and chords. Small enough
 * to cache locally so the sheet opens with zero spinner and survives a dead
 * signal in a rehearsal room.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PerformLine {
  id?: string;
  text: string;
  chords?: { symbol: string; at: number }[];
}

export interface PerformSection {
  section_id: string;
  kind: string;
  label: string;
  position: string;
  lines: PerformLine[];
  plain_text: string;
}

export interface PerformView {
  song_id: string;
  title: string;
  key_signature: string | null;
  tempo_bpm: number | null;
  time_signature: string | null;
  updated_at: string;
  sections: PerformSection[];
}

const CACHE_PREFIX = "cog:perform:";

export async function fetchPerformView(songId: string): Promise<PerformView> {
  const { data, error } = await (supabase as any).rpc("song_performance_view", {
    _song_id: songId,
  });
  if (error) throw error;
  const view = data as PerformView;
  try {
    localStorage.setItem(CACHE_PREFIX + songId, JSON.stringify(view));
  } catch {
    /* quota / private mode — caching is a bonus, never a requirement */
  }
  return view;
}

/** Instant first paint: last known sheet for this song, or null. */
export function cachedPerformView(songId: string): PerformView | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + songId);
    return raw ? (JSON.parse(raw) as PerformView) : null;
  } catch {
    return null;
  }
}

/** Rough seconds per section at the song's tempo — used to pace autoscroll. */
export function estimateSectionSeconds(section: PerformSection, bpm: number | null): number {
  const lines = Math.max(1, section.lines.length);
  const beatsPerLine = 4;
  const tempo = bpm && bpm > 0 ? bpm : 76;
  return (lines * beatsPerLine * 60) / tempo;
}

export function totalPerformSeconds(view: PerformView): number {
  return view.sections.reduce((sum, s) => sum + estimateSectionSeconds(s, view.tempo_bpm), 0);
}
