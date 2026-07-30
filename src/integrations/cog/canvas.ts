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
  /** Non-null = removed from the room but recoverable for 30 days. */
  archived_at?: string | null;
  archived_by?: string | null;
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
    .is("archived_at", null)
    .order("position", { ascending: true });
  if (error) throw toCogError(error);
  return (data ?? []) as CanvasCard[];
}

/**
 * Remove a card from the room — RECOVERABLE.
 *
 * Nothing a writer puts into a song should ever be unrecoverable. This is a
 * soft archive: the card leaves the feed, search, and section counts
 * immediately, and stays restorable for 30 days (`restoreCanvasCard`).
 * Pair it with an undo toast: archive → toast "Removed · Undo" → restore.
 */
export async function archiveCanvasCard(id: string): Promise<void> {
  await rpc("archive_canvas_card", { _card_id: id });
}

/** Undo an archive. Safe to call on an already-live card. */
export async function restoreCanvasCard(id: string): Promise<void> {
  await rpc("restore_canvas_card", { _card_id: id });
}

export type ArchivedCard = Pick<
  CanvasCard,
  "id" | "song_id" | "kind" | "label" | "body" | "section_kind" | "section_label" | "tree_kind" | "take_id" | "created_by"
> & { archived_at: string; archived_by: string | null };

/** The song's "recently removed" drawer — last 30 days, newest first. */
export async function listArchivedCanvasCards(
  song_id: string,
  limit = 50,
): Promise<ArchivedCard[]> {
  const data = await rpc<{ cards: ArchivedCard[] }>("list_archived_canvas_cards", {
    _song_id: song_id,
    _limit: limit,
  });
  return data?.cards ?? [];
}

/** @deprecated Destructive deletes are gone — this now archives (recoverable). */
export async function deleteCanvasCard(id: string): Promise<void> {
  await archiveCanvasCard(id);
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
// ---------- Durable, duplicate-safe create ----------

export {
  queueCreateCard,
  flushOutbox,
  startOutbox,
  subscribeOutbox,
  getOutboxStatus,
  newClientKey,
} from "./outbox";
export type { OutboxEntry, OutboxStatus, QueueCardInput } from "./outbox";

/**
 * Create a card exactly once, even across retries. Prefer this over
 * `createCanvasCard` for anything born from a user gesture in the room:
 * the write is journalled to disk first, so a dropped connection can never
 * lose the idea, and the (song_id, client_key) uniqueness on the server
 * means a retry returns the same card instead of a duplicate.
 */
export async function createCanvasCardIdempotent(
  input: CreateCanvasCardInput & { client_key?: string; take_id?: string | null },
): Promise<CanvasCard | null> {
  const { queueCreateCard } = await import("./outbox");
  return queueCreateCard({
    song_id: input.song_id,
    kind: input.kind,
    body: input.body,
    label: input.label ?? null,
    section_kind: input.section_kind ?? null,
    section_label: input.section_label ?? null,
    tree_kind: input.tree_kind ?? "ideas",
    x: input.x ?? null,
    y: input.y ?? null,
    parent_card_id: input.parent_card_id ?? null,
    take_id: input.take_id ?? null,
    client_key: input.client_key,
  });
}
