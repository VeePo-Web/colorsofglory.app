import { supabase } from "@/integrations/supabase/client";

export type SectionKind =
  | "verse"
  | "chorus"
  | "bridge"
  | "pre_chorus"
  | "intro"
  | "outro"
  | "hook"
  | "tag"
  | "other";

export type MergeResult = {
  section_id: string;
  position: number;
  kind: SectionKind;
  label: string | null;
  line_count: number;
  cards_used: number;
};

export type MergeCardsInput = {
  songId: string;
  /** Card ids in the exact order the user picked them — that is the line order. */
  cardIds: string[];
  kind?: SectionKind;
  label?: string | null;
  /** Archive the source cards so the canvas stays clean. Default true. */
  archiveSources?: boolean;
};

/**
 * Merge two or more idea cards into one real song section.
 * Atomic: section + lyrics + card provenance + activity in a single call.
 */
export async function mergeCardsIntoSection(
  input: MergeCardsInput,
): Promise<MergeResult> {
  const { data, error } = await supabase.rpc("merge_cards_into_section", {
    _song_id: input.songId,
    _card_ids: input.cardIds,
    _kind: input.kind ?? "verse",
    _label: input.label ?? null,
    _archive_sources: input.archiveSources ?? true,
  } as never);

  if (error) throw new Error(mergeErrorMessage(error.message));
  return data as unknown as MergeResult;
}

function mergeErrorMessage(raw: string): string {
  if (raw.includes("no_cards")) return "Pick at least two ideas to merge.";
  if (raw.includes("no_usable_cards")) return "Those ideas have no text to merge.";
  if (raw.includes("forbidden") || raw.includes("not_member"))
    return "You don't have edit access to this song.";
  return "Couldn't merge those ideas. Try again.";
}
