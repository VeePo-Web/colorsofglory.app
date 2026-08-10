import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarColor, getAvatarInitials } from "@/lib/invite/inviteContext";

export interface SongCollaborator {
  userId: string;
  firstName: string;
  lastName: string;
  role: string;
  isOwner: boolean;
  avatarColor: string;
  avatarInitials: string;
}

/**
 * Live collaborator list for one song — the single source both the People
 * surface and the canvas share sheet read, so "in this room" always means the
 * same people everywhere. Resolves calmly: on any backend error the previous
 * (or empty) list stands and the room remains usable.
 *
 * Freshness: refetches when the window regains focus and whenever the caller
 * bumps `refreshKey` (the canvas passes its live-presence count, so a
 * co-writer walking in pulls their roster row immediately — the owner never
 * needs a remount to see who just joined).
 */
export function useSongCollaborators(songId: string, refreshKey?: number): SongCollaborator[] {
  const [collaborators, setCollaborators] = useState<SongCollaborator[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { data } = await supabase
          .from("song_members")
          .select("user_id, role, profiles!inner(display_name, avatar_url)")
          .eq("song_id", songId);

        if (!active || !data?.length) return;
        setCollaborators(
          data.map((m) => {
            const profile = (m as { profiles?: { display_name?: string } }).profiles;
            const name = profile?.display_name ?? "Unknown";
            const parts = name.trim().split(/\s+/);
            const first = parts[0] ?? name;
            const last = parts.slice(1).join(" ");
            return {
              userId: m.user_id,
              firstName: first,
              lastName: last,
              role: m.role === "owner" ? "Owner" : m.role === "collaborator" ? "Contributor" : "Viewer",
              isOwner: m.role === "owner",
              avatarColor: getAvatarColor(m.user_id),
              avatarInitials: getAvatarInitials(first, last),
            } satisfies SongCollaborator;
          }),
        );
      } catch {
        // Keep whatever we had — the room stays usable without the roster.
      }
    };

    void load();

    // A returning tab re-reads the room — the cheapest honest freshness.
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [songId, refreshKey]);

  return collaborators;
}
