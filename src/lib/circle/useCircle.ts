import { useEffect, useState } from "react";
import { getActivitySince } from "@/integrations/cog/activity";
import { listMySongs } from "@/integrations/cog/songs";
import { useCurrentAccount } from "@/integrations/cog/auth";
import { supabase } from "@/integrations/supabase/client";
import { readAmenState } from "@/lib/canvas/collab/amens";
import {
  buildCircleDigest,
  buildCirclePeople,
  countRecentAmens,
  readCircleAnchor,
  writeCircleAnchor,
  type CircleLine,
  type CirclePerson,
  type CircleSongEvents,
} from "./circleModel";

/**
 * useCircle — the return surface's data, aggregated from seams that already
 * exist (my songs → per-song activity since my last Circle visit → the
 * shared members roster → the amen stores). Read-mostly, bounded, and calm:
 * every failure collapses to an empty band, never an error wall.
 *
 * The anchor is snapshotted BEFORE it advances, so this visit's digest
 * covers "since you were last here" and a refresh mid-visit stays quiet.
 * (An efficient `list_my_circle_since` RPC is the filed A3 upgrade —
 * docs/CIRCLE-CONTRACT.md; this client merge is bounded to the 8 most
 * recently active songs meanwhile.)
 */

const MAX_SONGS = 8;

export interface CircleData {
  loading: boolean;
  /** "While you were away…" — grouped, capped, others-only. */
  lines: CircleLine[];
  /** The co-writers across your songs. */
  people: CirclePerson[];
  /** Encouragement in: others' amens across your songs since the anchor. */
  amens: { total: number; songTitles: string[] };
  /** True when the account has no songs with other people yet. */
  aloneSoFar: boolean;
}

export function useCircle(): CircleData {
  const { profile } = useCurrentAccount();
  const myId = profile?.user_id ?? null;
  const [data, setData] = useState<CircleData>({
    loading: true,
    lines: [],
    people: [],
    amens: { total: 0, songTitles: [] },
    aloneSoFar: false,
  });

  useEffect(() => {
    let live = true;
    const anchor = readCircleAnchor();
    // This visit becomes the next baseline — snapshot first, then advance.
    writeCircleAnchor(new Date().toISOString());

    (async () => {
      try {
        const songs = (await listMySongs()).slice(0, MAX_SONGS);
        if (songs.length === 0) {
          if (live) setData((d) => ({ ...d, loading: false, aloneSoFar: true }));
          return;
        }

        const [perSong, memberRows] = await Promise.all([
          Promise.all(
            songs.map(async (s): Promise<CircleSongEvents> => ({
              songId: s.id,
              songTitle: s.title,
              events: await getActivitySince(s.id, anchor).catch(() => []),
            })),
          ),
          // One roster query across all songs — the people band.
          supabase
            .from("song_members")
            .select("song_id, user_id, profiles!inner(display_name)")
            .in("song_id", songs.map((s) => s.id))
            .limit(200)
            .then(({ data: rows }) => rows ?? [])
            .then((rows) =>
              rows.map((r) => {
                const song = songs.find((s) => s.id === r.song_id);
                const prof = (r as { profiles?: { display_name?: string | null } }).profiles;
                return {
                  userId: r.user_id as string,
                  name: prof?.display_name ?? "Someone",
                  songId: r.song_id as string,
                  songTitle: song?.title ?? "a song",
                };
              }),
            )
            .catch(() => [] as Array<{ userId: string; name: string; songId: string; songTitle: string }>),
        ]);

        const amens = countRecentAmens(
          songs.map((s) => ({ songTitle: s.title, rows: readAmenState(s.id).rows })),
          myId,
          anchor,
        );

        if (!live) return;
        const people = buildCirclePeople(memberRows, myId);
        setData({
          loading: false,
          lines: buildCircleDigest(perSong, myId),
          people,
          amens,
          aloneSoFar: people.length === 0,
        });
      } catch {
        if (live) setData((d) => ({ ...d, loading: false }));
      }
    })();

    return () => {
      live = false;
    };
    // Anchor semantics are per-mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId]);

  return data;
}
