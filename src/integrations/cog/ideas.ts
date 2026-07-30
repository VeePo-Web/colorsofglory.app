import { supabase } from "@/integrations/supabase/client";

/**
 * R60 — The ideas shelf.
 *
 * The board and the shelf are the SAME data. `position` is the single
 * reading order (top row first, then left to right). Phones show the
 * shelf; larger screens may show the board. They can never disagree.
 */

export type IdeaCard = {
  id: string;
  song_id: string;
  position: number;
  x: number | null;
  y: number | null;
  kind: string;
  title: string | null;
  body: string | null;
  take_id: string | null;
  created_by: string | null;
  created_at: string;
};

/** Recompute reading order from board coordinates. Silent — no activity event. */
export async function tidyIdeas(songId: string): Promise<number> {
  const { data, error } = await supabase.rpc("canvas_reading_order", {
    _song_id: songId,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Move one idea to a new slot in the shelf. 1-based. */
export async function moveIdea(cardId: string, newPosition: number): Promise<number> {
  const { data, error } = await supabase.rpc("canvas_reorder_card", {
    _card_id: cardId,
    _new_position: newPosition,
  });
  if (error) throw error;
  return (data as number) ?? newPosition;
}

/** The shelf, in order. One query, no client sorting by coordinates. */
export async function listIdeas(songId: string): Promise<IdeaCard[]> {
  const { data, error } = await supabase
    .from("canvas_cards")
    .select("id,song_id,position,x,y,kind,title,body,take_id,created_by,created_at")
    .eq("song_id", songId)
    .is("archived_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as IdeaCard[];
}

/** Optimistic local reorder so the list never waits on the network. */
export function reorderLocal<T extends { id: string; position: number }>(
  cards: T[],
  cardId: string,
  newPosition: number,
): T[] {
  const list = [...cards].sort((a, b) => a.position - b.position);
  const from = list.findIndex((c) => c.id === cardId);
  if (from < 0) return cards;
  const to = Math.max(0, Math.min(newPosition - 1, list.length - 1));
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  return list.map((c, i) => ({ ...c, position: i + 1 }));
}
