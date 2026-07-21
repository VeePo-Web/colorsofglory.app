import { supabase } from "@/integrations/supabase/client";

/**
 * Card reactions ("Amens") — the encouragement layer's data seam.
 *
 * The `card_reactions` table is a filed schema ask (docs/AMENS-CONTRACT.md);
 * until Lovable lands it, every function here degrades to a clean no-op and
 * the feature runs device-local. The PROBE is the gate: one cheap select per
 * session decides whether server sync + realtime even get attempted, so a
 * missing table can never surface an error — and critically, reactions get
 * their OWN realtime channel, never a listener on the shared song-room
 * channel (a CHANNEL_ERROR from a nonexistent table must not take down
 * activity/card/take subscriptions).
 */

export type CardReactionKind = "amen" | "heart" | "keeper";

export type CardReactionRow = {
  id: string;
  song_id: string;
  card_id: string;
  user_id: string;
  kind: CardReactionKind;
  /** Optional short word of encouragement (schema-ready; UI ships next slice). */
  note_text: string | null;
  created_at: string;
};

const TABLE = "card_reactions";

/** Errors that mean "the table isn't there yet" — cache those; retry the rest. */
const MISSING_TABLE = /relation .* does not exist|Could not find the table|42P01|PGRST205/i;

let probeResult: boolean | null = null;
let probeInFlight: Promise<boolean> | null = null;

/**
 * Is the card_reactions table live? Definitive answers are cached for the
 * session; transient failures (offline, 5xx) are NOT cached so a later call
 * retries. Never throws.
 */
export async function probeReactionsTable(): Promise<boolean> {
  if (probeResult !== null) return probeResult;
  if (probeInFlight) return probeInFlight;
  probeInFlight = (async () => {
    try {
      const { error } = await (supabase as any).from(TABLE).select("id").limit(1);
      if (!error) {
        probeResult = true;
        return true;
      }
      if (MISSING_TABLE.test(`${error.code ?? ""} ${error.message ?? ""}`)) {
        probeResult = false; // definitive: not deployed yet
      }
      return false;
    } catch {
      return false; // transient — leave probeResult null so we retry
    } finally {
      probeInFlight = null;
    }
  })();
  return probeInFlight;
}

/** Test hook: reset the cached probe (unit tests only). */
export function __resetReactionsProbe(): void {
  probeResult = null;
  probeInFlight = null;
}

/**
 * All reactions in a song. `null` means "couldn't read" (missing table,
 * offline, 5xx) — callers must NOT merge that as emptiness, or a transient
 * failure would wipe everyone's amens locally and mis-complete pending
 * removes. A real empty song returns []. Never throws.
 */
export async function listCardReactions(song_id: string): Promise<CardReactionRow[] | null> {
  if (!(await probeReactionsTable())) return null;
  try {
    const { data, error } = await (supabase as any)
      .from(TABLE)
      .select("id, song_id, card_id, user_id, kind, note_text, created_at")
      .eq("song_id", song_id)
      .order("created_at", { ascending: true })
      .limit(1000);
    if (error) return null;
    return (data ?? []) as CardReactionRow[];
  } catch {
    return null;
  }
}

/**
 * Add my reaction. Returns the server row, or null when the table/network
 * isn't there (the device store keeps the amen either way). Idempotent-ish:
 * a unique-violation (already amened from another device) is treated as
 * success-shaped null — the realtime/list path reconciles.
 */
export async function addCardReaction(input: {
  song_id: string;
  card_id: string;
  kind: CardReactionKind;
  note_text?: string | null;
}): Promise<CardReactionRow | null> {
  if (!(await probeReactionsTable())) return null;
  try {
    const { data, error } = await (supabase as any)
      .from(TABLE)
      .insert({
        song_id: input.song_id,
        card_id: input.card_id,
        kind: input.kind,
        note_text: input.note_text ?? null,
      })
      .select("id, song_id, card_id, user_id, kind, note_text, created_at")
      .single();
    if (error || !data) return null;
    return data as CardReactionRow;
  } catch {
    return null;
  }
}

/**
 * Quietly withdraw my reaction on a card (RLS: delete own only). True on a
 * confirmed server delete; false means "retry later" — never throws.
 */
export async function removeCardReaction(input: {
  song_id: string;
  card_id: string;
  kind: CardReactionKind;
}): Promise<boolean> {
  if (!(await probeReactionsTable())) return false;
  try {
    const { error } = await (supabase as any)
      .from(TABLE)
      .delete()
      .eq("song_id", input.song_id)
      .eq("card_id", input.card_id)
      .eq("kind", input.kind);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Realtime reactions for one song, on a DEDICATED channel. Subscribes only
 * after the probe confirms the table exists; returns an unsubscribe either
 * way. The callback receives no payload detail — callers re-list (rows are
 * tiny and capped, and this sidesteps RLS-shaped partial payloads).
 */
export function subscribeCardReactions(song_id: string, onChange: () => void): () => void {
  let disposed = false;
  let teardown: (() => void) | null = null;
  void probeReactionsTable().then((ok) => {
    if (!ok || disposed) return;
    try {
      const channel = (supabase as any)
        .channel(`card-reactions-${song_id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: TABLE, filter: `song_id=eq.${song_id}` },
          () => onChange(),
        )
        .subscribe();
      teardown = () => {
        try {
          (supabase as any).removeChannel(channel);
        } catch {
          /* channel already gone */
        }
      };
      if (disposed) teardown();
    } catch {
      /* realtime unavailable — polling-free local mode still works */
    }
  });
  return () => {
    disposed = true;
    teardown?.();
  };
}
