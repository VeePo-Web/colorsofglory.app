import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildBandIndex, type BandPerson } from "@/lib/library/bandIndex";

/**
 * The people already writing WITH you (from your other songs) who are not in
 * THIS song yet — the "add your people" list on the invite sheet.
 *
 * Self-contained three-query batch, every step RLS-proven (see
 * docs/library/BAND-SHELF-VISION.md §1): my membership rows → all rosters of
 * my songs → profile display columns (explicit list; embeds can't work — no
 * FK from song_members to profiles).
 */
export function useKnownPeople(myUserId: string | null, excludeSongId: string) {
  const query = useQuery<BandPerson[]>({
    queryKey: ["known-people", myUserId ?? "anon", excludeSongId],
    enabled: !!myUserId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: mine } = await supabase
        .from("song_members")
        .select("song_id")
        .eq("user_id", myUserId!);
      const songIds = [...new Set((mine ?? []).map((r) => r.song_id))];
      if (songIds.length === 0) return [];

      const { data: memberRows } = await supabase
        .from("song_members")
        .select("song_id, user_id, role")
        .in("song_id", songIds);
      if (!memberRows?.length) return [];

      const inThisSong = new Set(
        memberRows.filter((r) => r.song_id === excludeSongId).map((r) => r.user_id),
      );

      const userIds = [...new Set(memberRows.map((r) => r.user_id))];
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("user_id, display_name, first_name, avatar_color")
        .in("user_id", userIds);

      const { people } = buildBandIndex(memberRows, profileRows ?? [], myUserId);
      return people.filter((p) => !inThisSong.has(p.userId));
    },
  });

  return { people: query.data ?? [], loading: query.isLoading };
}
