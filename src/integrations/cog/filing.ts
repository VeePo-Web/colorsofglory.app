/**
 * R44 — "This hum belongs in the chorus"
 *
 * Ideas arrive before structure. Someone hums a melody in the car; only later
 * does it become the bridge. Until now a recording was stuck wherever it landed,
 * so the room slowly filled with unattached audio and the writer lost the thread.
 *
 * Filing is one tap: pick a section, the memo moves, the room re-groups.
 * Unfiling is the same tap on "Not filed yet". Nothing is ever deleted.
 */
import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export type UnfiledMemo = {
  id: string;
  title: string | null;
  duration_ms: number | null;
  waveform_peaks: number[] | null;
  author_user_id: string;
  created_at: string;
};

export type FiledResult = {
  memo_id: string;
  section_id: string | null;
  section_label: string | null;
};

/** Move a recording under a section, or pass null to unfile it. */
export async function fileMemo(
  memo_id: string,
  section_id: string | null,
): Promise<FiledResult> {
  const { data, error } = await (supabase as any).rpc("move_memo_to_section", {
    _memo_id: memo_id,
    _section_id: section_id,
  });
  if (error) throw toCogError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return row as FiledResult;
}

/** Recordings in this song that don't belong to a section yet. */
export async function fetchUnfiledMemos(song_id: string): Promise<UnfiledMemo[]> {
  const { data, error } = await (supabase as any).rpc("song_unfiled_memos", {
    _song_id: song_id,
  });
  if (error) throw toCogError(error);
  return (data ?? []) as UnfiledMemo[];
}

/**
 * The section we should put at the top of the picker: the one the writer is
 * looking at, then the most recently touched, then plain song order. Keeps the
 * common case to a single tap without any "smart" behaviour the user can't predict.
 */
export function rankSections<T extends { id: string; position?: number | null }>(
  sections: T[],
  opts: { focusedSectionId?: string | null; lastFiledSectionId?: string | null } = {},
): T[] {
  const score = (s: T) => {
    if (s.id === opts.focusedSectionId) return 0;
    if (s.id === opts.lastFiledSectionId) return 1;
    return 2;
  };
  return [...sections].sort(
    (a, b) => score(a) - score(b) || (a.position ?? 0) - (b.position ?? 0),
  );
}

/** Single calm line for an unfiled memo card. */
export function unfiledLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 recording isn't filed yet" : `${count} recordings aren't filed yet`;
}
