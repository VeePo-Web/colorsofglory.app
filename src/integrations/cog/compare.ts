import { supabase } from "@/integrations/supabase/client";

export type CompareTake = {
  id: string;
  voice_memo_id: string;
  section_id: string | null;
  section_kind: string | null;
  section_label: string | null;
  name: string;
  duration_ms: number | null;
  storage_path: string;
  mime_type: string;
  is_primary: boolean;
  is_archived: boolean;
  waveform_peaks: number[] | null;
  created_by: string;
  created_by_name: string | null;
  created_by_color: string | null;
  created_at: string;
};

export type CompareBoard = {
  song_id: string;
  section_id: string | null;
  takes: CompareTake[];
  generated_at: string;
};

/** All live takes for a section (or the whole song) — A vs B in one request. */
export async function fetchCompareTakes(
  songId: string,
  sectionId?: string | null,
): Promise<CompareBoard> {
  const { data, error } = await supabase.rpc("song_compare_takes", {
    _song_id: songId,
    _section_id: sectionId ?? null,
  } as never);
  if (error) throw new Error("Couldn't load the takes to compare.");
  return data as unknown as CompareBoard;
}

/** Pick the keeper. Optionally set the loser aside in the same step. */
export async function chooseTake(
  takeId: string,
  setAsideTakeId?: string | null,
): Promise<{ take_id: string; voice_memo_id: string }> {
  const { data, error } = await supabase.rpc("choose_take", {
    _take_id: takeId,
    _set_aside_take_id: setAsideTakeId ?? null,
  } as never);
  if (error) {
    if (error.message.includes("take_not_found")) throw new Error("That take is gone.");
    if (error.message.includes("forbidden"))
      throw new Error("You don't have edit access to this song.");
    throw new Error("Couldn't save that choice. Try again.");
  }
  return data as unknown as { take_id: string; voice_memo_id: string };
}

/** Two takes are comparable when they belong to the same section. */
export function comparablePairs(takes: CompareTake[]): CompareTake[][] {
  const groups = new Map<string, CompareTake[]>();
  for (const t of takes) {
    const key = t.section_id ?? "unfiled";
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}
