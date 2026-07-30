/**
 * R53 · One live channel per song room.
 *
 * Before this file the room opened THREE websocket channels (`song:{id}` for
 * data, `presence:song:{id}`, `focus:song:{id}`) and still missed the three
 * tables collaboration actually runs on: `lyric_suggestions`, `song_notes`
 * and `card_reactions`. A suggestion left by a co-writer only appeared after a
 * manual refetch — the room looked dead while someone was clearly in it.
 *
 * `subscribeRoomChanges` is the single data subscription for a song:
 *   - ONE channel topic per song, refcounted, so five components mounting the
 *     hook share one socket subscription instead of five.
 *   - Every collaboration table is covered.
 *   - Notifications are COALESCED (120 ms). A remote burst — accept a
 *     suggestion → lyric update + activity insert + reaction — invalidates
 *     each affected slice exactly once, so the room re-reads in a single pass.
 *   - Payloads are dropped on the floor, as everywhere else in the seam: the
 *     channel says WHAT changed, React Query owns what it now is.
 */
import { supabase } from "@/integrations/supabase/client";

/** The slices of the room a remote change can touch. */
export type RoomChangeKind =
  | "activity"
  | "cards"
  | "takes"
  | "captures"
  | "song"
  | "suggestions"
  | "notes"
  | "reactions"
  | "members"
  | "lyrics"
  | "sections";

type Listener = (kinds: RoomChangeKind[]) => void;

const COALESCE_MS = 120;

type Entry = {
  channel: ReturnType<typeof supabase.channel>;
  listeners: Set<Listener>;
  pending: Set<RoomChangeKind>;
  timer: ReturnType<typeof setTimeout> | null;
};

const rooms = new Map<string, Entry>();

/** table → slice, all filtered by `song_id` unless noted. */
const TABLES: ReadonlyArray<{ table: string; kind: RoomChangeKind; byId?: boolean }> = [
  { table: "song_activity", kind: "activity" },
  { table: "canvas_cards", kind: "cards" },
  { table: "takes", kind: "takes" },
  { table: "idea_captures", kind: "captures" },
  { table: "lyric_suggestions", kind: "suggestions" },
  { table: "song_notes", kind: "notes" },
  { table: "card_reactions", kind: "reactions" },
  { table: "song_members", kind: "members" },
  { table: "song_lyrics", kind: "lyrics" },
  { table: "song_sections", kind: "sections" },
  { table: "songs", kind: "song", byId: true },
];

function open(song_id: string): Entry {
  const channel = supabase.channel(`room:${song_id}`);
  const entry: Entry = { channel, listeners: new Set(), pending: new Set(), timer: null };

  const flush = () => {
    entry.timer = null;
    const kinds = Array.from(entry.pending);
    entry.pending.clear();
    if (kinds.length === 0) return;
    for (const listener of entry.listeners) listener(kinds);
  };

  const mark = (kind: RoomChangeKind) => {
    entry.pending.add(kind);
    if (entry.timer) return;
    entry.timer = setTimeout(flush, COALESCE_MS);
  };

  for (const { table, kind, byId } of TABLES) {
    channel.on(
      "postgres_changes" as any,
      {
        event: "*",
        schema: "public",
        table,
        filter: byId ? `id=eq.${song_id}` : `song_id=eq.${song_id}`,
      },
      (() => mark(kind)) as any,
    );
  }

  channel.subscribe();
  rooms.set(song_id, entry);
  return entry;
}

/**
 * Listen to every remote change in one song room. Returns an unsubscribe;
 * the underlying channel closes only when the LAST listener leaves.
 */
export function subscribeRoomChanges(song_id: string, onChange: Listener): () => void {
  const entry = rooms.get(song_id) ?? open(song_id);
  entry.listeners.add(onChange);

  return () => {
    entry.listeners.delete(onChange);
    if (entry.listeners.size > 0) return;
    if (entry.timer) clearTimeout(entry.timer);
    rooms.delete(song_id);
    void supabase.removeChannel(entry.channel);
  };
}