import { supabase } from "@/integrations/supabase/client";
import type { TranscriptBlock } from "./transcript";

// Cast to `any` for table access because generated `Database` types lag
// behind a freshly applied migration. Types regenerate on the next pull.
const db = supabase as unknown as {
  from: (table: string) => any;
  functions: typeof supabase.functions;
};

export type CanvasCard = {
  id: string;
  song_id: string;
  created_by: string;
  take_id: string | null;
  kind: "lyrics" | "chords" | "scripture" | "idea" | "section";
  section_kind: string | null;
  label: string | null;
  body: string;
  start_ms: number | null;
  end_ms: number | null;
  position: number;
  x: number | null;
  y: number | null;
  created_at: string;
  updated_at: string;
};

export type CommitTakeResult = { song_id: string; card_ids: string[] };

export type CommitTakeInput = {
  take_id: string;
  /** Existing song id, or "__new__" to create a new song. */
  song_id: string | "__new__";
  new_song_title?: string;
  blocks: Pick<TranscriptBlock, "kind" | "section_kind" | "label" | "text" | "start_ms" | "end_ms">[];
};

export async function commitTakeToCanvas(input: CommitTakeInput): Promise<CommitTakeResult> {
  const { data, error } = await supabase.functions.invoke("commit-take", { body: input });
  if (error) throw error;
  return data as CommitTakeResult;
}

export async function listCanvasCards(song_id: string): Promise<CanvasCard[]> {
  const { data, error } = await db
    .from("canvas_cards")
    .select("*")
    .eq("song_id", song_id)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CanvasCard[];
}

export async function deleteCanvasCard(id: string): Promise<void> {
  const { error } = await db.from("canvas_cards").delete().eq("id", id);
  if (error) throw error;
}

export async function updateCanvasCard(
  id: string,
  patch: Partial<Pick<CanvasCard, "label" | "body" | "kind" | "section_kind" | "position" | "x" | "y">>,
): Promise<void> {
  const { error } = await db.from("canvas_cards").update(patch).eq("id", id);
  if (error) throw error;
}