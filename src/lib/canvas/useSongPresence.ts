import { useEffect, useState } from "react";
import { subscribeSongPresence, type PresenceIdentity } from "@/integrations/cog/realtime";

export type PresenceMember = PresenceIdentity & { isSelf: boolean };

/**
 * Live "who's here now" for a song room. Wraps Supabase Realtime Presence and
 * returns the current roster (self flagged). Fails soft: if realtime is
 * unavailable the list simply stays empty and the caller falls back to the
 * inferred roster — presence is an enhancement, never a dependency.
 *
 * `self` must be stable-ish (memoized by the caller) or the channel re-tracks
 * on every render; pass null until identity is known to avoid a churn of joins.
 */
export function useSongPresence(songId: string, self: PresenceIdentity | null): PresenceMember[] {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const selfKey = self ? `${self.userId}|${self.name}|${self.color}` : "";

  useEffect(() => {
    if (!self) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeSongPresence(songId, self, (roster) => {
        setMembers(roster.map((m) => ({ ...m, isSelf: m.userId === self.userId })));
      });
    } catch {
      // Realtime not available — the room stays usable; presence is optional.
    }
    return () => {
      try { unsub?.(); } catch { /* channel already gone */ }
      setMembers([]);
    };
    // selfKey captures the identity fields that matter; songId re-subscribes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId, selfKey]);

  return members;
}
