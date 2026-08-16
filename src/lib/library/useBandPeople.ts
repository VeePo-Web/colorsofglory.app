import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildBandIndex, type BandIndex } from "./bandIndex";

const EMPTY: BandIndex = { membersBySong: new Map(), people: [] };

/**
 * The band, read from the memberships that already exist — two batched
 * queries, both RLS-proven (see docs/library/BAND-SHELF-VISION.md §1):
 *
 *   1. song_members `.in('song_id', myVisibleSongIds)` — "Members can view
 *      membership" lets a member read EVERY member row of EVERY song they
 *      belong to; non-member songs are silently filtered, never errored.
 *   2. profiles `.in('user_id', ids)` with an EXPLICIT display-column list —
 *      the column-level grant excludes email/phone, so `select('*')` would
 *      fail, and `profiles!inner(...)` embeds CANNOT work (no FK).
 *
 * Filed with Lovable: a `list_my_song_members()` RPC to make this one round
 * trip. Until then this is the canonical shape — do not copy the embed.
 */
export function useBandPeople(songIds: string[], myUserId: string | null) {
  const sortedIds = [...songIds].sort();
  const query = useQuery<BandIndex>({
    queryKey: ["band-people", sortedIds.join(","), myUserId ?? "anon"],
    enabled: sortedIds.length > 0,
    staleTime: 60_000,
    // The song set changes often (archive, create) and mints a new key — keep
    // the previous band on screen while the fresh one loads, so chips and an
    // active filter never flash the shelf empty mid-flight.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data: memberRows, error: membersError } = await supabase
        .from("song_members")
        .select("song_id, user_id, role")
        .in("song_id", sortedIds);
      // A FAILED read must stay a failure (retry + previous data) — swallowing
      // it as an empty band once blanked a full library under an active filter.
      if (membersError) throw membersError;
      if (!memberRows?.length) return EMPTY;

      const userIds = [...new Set(memberRows.map((r) => r.user_id))];
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, first_name, avatar_color")
        .in("user_id", userIds);
      if (profilesError) throw profilesError;

      return buildBandIndex(memberRows, profileRows ?? [], myUserId);
    },
  });

  return {
    band: query.data ?? EMPTY,
    loading: query.isLoading,
  };
}
