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
};

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

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}