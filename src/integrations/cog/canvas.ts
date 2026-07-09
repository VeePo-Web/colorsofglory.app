import { supabase } from "@/integrations/supabase/client";
import type { TranscriptBlock } from "./transcript";
import { call, toCogError } from "./errors";

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
  parent_card_id: string | null;
  group_id: string | null;
  tree_kind: "ideas" | "final";
  section_label: string | null;
  z_index: number;
};

export type CommitTakeResult = { song_id: string; card_ids: string[] };

export type CommitTakeInput = {
  take_id: string;
  /** Existing song id, or "__new__" to create a new song. */
  song_id: string | "__new__";
  new_song_title?: string;
  blocks: Pick<TranscriptBlock, "kind" | "section_kind" | "label" | "text" | "start_ms" | "end_ms">[];
};

/**
 * Commit a transcribed take onto the canvas. Routed through `call`, which
 * reads the edge function `{ error: "<code>" }` body off a non-2xx Response
 * and throws a CogError — so a new-song QUOTA_EXCEEDED_SONGS (and forbidden /
 * take_not_found) reaches the UI as `.code`, with the raw slug preserved on
 * `.message` for existing message-matching callers.
 */
export async function commitTakeToCanvas(input: CommitTakeInput): Promise<CommitTakeResult> {
  return call<CommitTakeResult>("commit-take", input);
}

export type CreateCanvasCardInput = {
  song_id: string;
  kind: CanvasCard["kind"];
  label?: string | null;
  body: string;
  section_kind?: string | null;
  section_label?: string | null;
  tree_kind?: "ideas" | "final";
  x?: number | null;
  y?: number | null;
  parent_card_id?: string | null;
  created_by?: string;
};

/**
 * Insert a canvas card directly (the client-side create path the engine audit
 * named as the missing persistence primitive). RLS is the wall — a rejected
 * insert is non-fatal for callers using the local-first pattern (the card
 * simply stays device-local until a backend contract lands).
 */
export async function createCanvasCard(input: CreateCanvasCardInput): Promise<CanvasCard> {
  const { data, error } = await db
    .from("canvas_cards")
    .insert({ position: 0, ...input })
    .select("*")
    .single();
  if (error) throw toCogError(error);
  return data as CanvasCard;
}

export async function listCanvasCards(song_id: string): Promise<CanvasCard[]> {
  const { data, error } = await db
    .from("canvas_cards")
    .select("*")
    .eq("song_id", song_id)
    .order("position", { ascending: true });
  if (error) throw toCogError(error);
  return (data ?? []) as CanvasCard[];
}

export async function deleteCanvasCard(id: string): Promise<void> {
  const { error } = await db.from("canvas_cards").delete().eq("id", id);
  if (error) throw toCogError(error);
}

export async function updateCanvasCard(
  id: string,
  patch: Partial<Pick<CanvasCard, "label" | "body" | "kind" | "section_kind" | "position" | "x" | "y">>,
): Promise<void> {
  const { error } = await db.from("canvas_cards").update(patch).eq("id", id);
  if (error) throw toCogError(error);
}

// ---------- Canvas write RPCs ----------

export type BulkMoveItem = { id: string; x: number; y: number; z?: number };

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw toCogError(error);
  return data as T;
}

export async function moveCard(
  card_id: string,
  x: number,
  y: number,
  z_index?: number,
): Promise<CanvasCard> {
  return rpc<CanvasCard>("canvas_move_card", {
    _card_id: card_id,
    _x: x,
    _y: y,
    _z_index: z_index ?? null,
  });
}

export async function bulkMoveCards(items: BulkMoveItem[]): Promise<number> {
  return rpc<number>("canvas_bulk_move", { _payload: items });
}

export async function linkCards(parent_id: string, child_id: string): Promise<CanvasCard> {
  return rpc<CanvasCard>("canvas_link_cards", {
    _parent_id: parent_id,
    _child_id: child_id,
  });
}

export async function unlinkCard(card_id: string): Promise<CanvasCard> {
  return rpc<CanvasCard>("canvas_unlink_card", { _card_id: card_id });
}

export async function groupCards(card_ids: string[]): Promise<string> {
  return rpc<string>("canvas_group_cards", { _card_ids: card_ids });
}

export async function setCardSection(
  card_id: string,
  section_label: string | null,
  tree_kind?: "ideas" | "final",
): Promise<CanvasCard> {
  return rpc<CanvasCard>("canvas_set_section", {
    _card_id: card_id,
    _section_label: section_label,
    _tree_kind: tree_kind ?? null,
  });
}

export async function promoteCardToFinal(card_id: string): Promise<CanvasCard> {
  return rpc<CanvasCard>("canvas_promote_to_final", { _card_id: card_id });
}