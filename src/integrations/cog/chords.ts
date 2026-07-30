/**
 * CHORDS data seam (R22 · "One key, one tempo, the chords under them").
 *
 * The chords view of the songwriting room is a READ of one RPC
 * (`song_chords_board`) and a small set of guarded writes. No component talks
 * to Supabase directly — everything goes through this module.
 *
 * Server rules (enforced in Postgres, mirrored here only as types):
 *  - read requires song membership
 *  - write requires owner/collaborator (viewers are rejected)
 *  - every write is logged to the song activity feed with IDs only
 */

import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export type ChordSymbol = string;

export interface ChordProgression {
  id: string;
  section_id: string | null;
  section_label: string | null;
  section_position: number | null;
  label: string | null;
  chords: ChordSymbol[];
  created_by_user_id: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChordsBoardSection {
  id: string;
  kind: string;
  label: string;
  position: number;
}

export interface ChordsBoard {
  song: {
    id: string;
    title: string;
    key_signature: string | null;
    tempo_bpm: number | null;
    time_signature: string | null;
  };
  role: "owner" | "collaborator" | "viewer" | null;
  progressions: ChordProgression[];
  sections: ChordsBoardSection[];
}

/** Everything the chords view needs, in ONE request. */
export async function getChordsBoard(songId: string): Promise<ChordsBoard> {
  const { data, error } = await supabase.rpc("song_chords_board", { _song_id: songId });
  if (error) throw toCogError(error);
  const board = (data ?? {}) as unknown as ChordsBoard;
  return {
    song: board.song ?? { id: songId, title: "", key_signature: null, tempo_bpm: null, time_signature: null },
    role: board.role ?? null,
    progressions: board.progressions ?? [],
    sections: board.sections ?? [],
  };
}

/** Create or update a progression. Omit `progressionId` to create. Returns its id. */
export async function saveChordProgression(input: {
  songId: string;
  chords: ChordSymbol[];
  progressionId?: string | null;
  sectionId?: string | null;
  label?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("save_chord_progression", {
    _song_id: input.songId,
    _chords: input.chords as unknown as never,
    _progression_id: input.progressionId ?? null,
    _section_id: input.sectionId ?? null,
    _label: input.label ?? null,
  });
  if (error) throw toCogError(error);
  return data as unknown as string;
}

/** Remove a progression. Resolves false when it was already gone. */
export async function deleteChordProgression(progressionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("delete_chord_progression", {
    _progression_id: progressionId,
  });
  if (error) throw toCogError(error);
  return Boolean(data);
}

/** Update key / tempo / time signature in one call. Only pass what changed. */
export async function setSongMusicalMeta(input: {
  songId: string;
  keySignature?: string | null;
  tempoBpm?: number | null;
  timeSignature?: string | null;
}): Promise<{ key_signature: string | null; tempo_bpm: number | null; time_signature: string | null }> {
  const { data, error } = await supabase.rpc("set_song_musical_meta", {
    _song_id: input.songId,
    _key_signature: input.keySignature ?? null,
    _tempo_bpm: input.tempoBpm ?? null,
    _time_signature: input.timeSignature ?? null,
  });
  if (error) throw toCogError(error);
  return data as unknown as { key_signature: string | null; tempo_bpm: number | null; time_signature: string | null };
}
