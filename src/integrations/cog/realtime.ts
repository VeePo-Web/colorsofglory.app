import { supabase } from "@/integrations/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/**
 * Song-room realtime channel: wraps the four tables that drive the Song
 * Workspace (activity feed, canvas, takes, captures) behind one typed API
 * so components never touch `supabase.channel(...)` directly.
 *
 * Usage:
 *   useEffect(() => {
 *     const unsub = subscribeSongRoom(songId, {
 *       onActivity: (e) => ...,
 *       onCardChange: (e) => ...,
 *     });
 *     return unsub;
 *   }, [songId]);
 */

export type SongRoomHandlers = {
  onActivity?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onCardChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onTakeChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  onCaptureChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  /** The song row itself (shared tempo, key, title). Fires on UPDATE. */
  onSongChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
};

/**
 * Live presence — who is actually in the song room right now (Supabase
 * Realtime Presence, not postgres). Ephemeral channel state only: nothing is
 * written to a table, so this stays entirely inside the frontend lane. Each
 * client tracks a small identity payload; the callback fires with the current
 * roster whenever anyone joins, leaves, or the channel syncs.
 */
export type PresenceIdentity = {
  userId: string;
  name: string;
  color: string;
  initials: string;
};

export function subscribeSongPresence(
  song_id: string,
  self: PresenceIdentity,
  onChange: (members: PresenceIdentity[]) => void,
): () => void {
  const channel = supabase.channel(`presence:song:${song_id}`, {
    config: { presence: { key: self.userId } },
  });

  const emit = () => {
    const state = channel.presenceState<PresenceIdentity>();
    // One entry per key; a person open in two tabs collapses to one avatar.
    const byUser = new Map<string, PresenceIdentity>();
    for (const metas of Object.values(state)) {
      const meta = metas[0];
      if (meta?.userId) byUser.set(meta.userId, meta);
    }
    onChange(Array.from(byUser.values()));
  };

  channel
    .on("presence", { event: "sync" }, emit)
    .on("presence", { event: "join" }, emit)
    .on("presence", { event: "leave" }, emit)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // track() must run only after the channel is joined.
        void channel.track(self);
      }
    });

  return () => {
    void channel.untrack();
    supabase.removeChannel(channel);
  };
}

/**
 * Account billing realtime — the signed-in user's plan + storage changes.
 * Fires `onChange("subscription")` when a `subscriptions` row moves and
 * `onChange("storage")` when a `storage_addons` row moves, so a plan upgrade or
 * a storage top-up made on another device re-hydrates the current one. Like
 * every seam channel this carries the TABLE + event kind only — never the row's
 * content; the caller re-reads the billing status through its query.
 */
export function subscribeBilling(
  user_id: string,
  onChange: (kind: "subscription" | "storage") => void,
): () => void {
  const channel = supabase
    .channel(`billing:${user_id}`)
    .on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user_id}` },
      () => onChange("subscription"),
    )
    .on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "storage_addons", filter: `user_id=eq.${user_id}` },
      () => onChange("storage"),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeSongRoom(song_id: string, handlers: SongRoomHandlers): () => void {
  const filter = `song_id=eq.${song_id}`;
  const channel = supabase.channel(`song:${song_id}`);

  if (handlers.onActivity) {
    channel.on(
      "postgres_changes" as any,
      { event: "INSERT", schema: "public", table: "song_activity", filter },
      handlers.onActivity as any,
    );
  }
  if (handlers.onCardChange) {
    channel.on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "canvas_cards", filter },
      handlers.onCardChange as any,
    );
  }
  if (handlers.onTakeChange) {
    channel.on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "takes", filter },
      handlers.onTakeChange as any,
    );
  }
  if (handlers.onCaptureChange) {
    channel.on(
      "postgres_changes" as any,
      { event: "*", schema: "public", table: "idea_captures", filter },
      handlers.onCaptureChange as any,
    );
  }
  if (handlers.onSongChange) {
    // The song row keys on `id`, not `song_id` — its own filter. This is how a
    // tempo set on one phone reaches every open metronome in the room live.
    channel.on(
      "postgres_changes" as any,
      { event: "UPDATE", schema: "public", table: "songs", filter: `id=eq.${song_id}` },
      handlers.onSongChange as any,
    );
  }

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Focused live subscription to a song's shared musical settings (tempo, time
 * signature). Its own channel topic — the room channel (`song:{id}`) is
 * already owned by the canvas, and two subscriptions on one topic from one
 * socket is a footgun. Used by useSongTempo so every open metronome in the
 * room re-reads the ONE shared BPM the moment anyone sets it.
 */
export function subscribeSongTempo(
  song_id: string,
  onChange: (next: { tempo_bpm: number | null; time_signature: string | null }) => void,
): () => void {
  const channel = supabase.channel(`song-tempo:${song_id}`);
  channel.on(
    "postgres_changes" as any,
    { event: "UPDATE", schema: "public", table: "songs", filter: `id=eq.${song_id}` },
    ((payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const next = payload.new as { tempo_bpm?: number | null; time_signature?: string | null };
      onChange({
        tempo_bpm: next?.tempo_bpm ?? null,
        time_signature: next?.time_signature ?? null,
      });
    }) as any,
  );
  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}