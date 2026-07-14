import { useCallback, useEffect, useState } from "react";
import { getSong, updateSongTempo } from "@/integrations/cog/songs";
import { subscribeSongTempo } from "@/integrations/cog/realtime";
import { clampBpm } from "@/lib/audio/metronome";

export interface UseSongTempoReturn {
  /** The ONE shared song tempo every collaborator's metronome reads. */
  bpm: number | null;
  /** Parsed from the song's time signature ("3/4" → 3). Defaults to 4. */
  beatsPerBar: number;
  /** Owner + collaborator may set the canonical tempo; viewers read it. */
  canEdit: boolean;
  loading: boolean;
  /**
   * Persist a CONFIRMED tempo as the song's canonical BPM and propagate it
   * live to every open client. Tapped or detected BPMs are proposals until
   * this is called — never silently authoritative. Resolves false (and rolls
   * back) when the server declines; the server stays the permission gate.
   */
  saveTempo: (bpm: number) => Promise<boolean>;
}

function parseBeatsPerBar(timeSignature: string | null | undefined): number {
  if (!timeSignature) return 4;
  const n = parseInt(timeSignature.split("/")[0] ?? "", 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : 4;
}

/**
 * useSongTempo — the shared song tempo, live.
 *
 * This is ASYNC tempo ALIGNMENT, not real-time click sync. Everyone records
 * locally to the shared BPM plus a bar-1 count-in; takes align because they
 * share a tempo and a downbeat, NOT because clocks are network-locked (which
 * is infeasible over the internet and unnecessary for COG's asynchronous
 * collaboration — do not attempt live cross-device click synchronization).
 */
export function useSongTempo(songId: string | undefined): UseSongTempoReturn {
  const [bpm, setBpm] = useState<number | null>(null);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(Boolean(songId));

  useEffect(() => {
    if (!songId) {
      setBpm(null);
      setBeatsPerBar(4);
      setCanEdit(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getSong(songId)
      .then((detail) => {
        if (cancelled || !detail) return;
        setBpm(detail.tempo_bpm);
        setBeatsPerBar(parseBeatsPerBar(detail.time_signature));
        setCanEdit(detail.my_role !== "viewer");
      })
      .catch(() => {
        /* tempo is an aid — a failed read must never break recording */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = subscribeSongTempo(songId, (next) => {
      if (cancelled) return;
      setBpm(next.tempo_bpm);
      setBeatsPerBar(parseBeatsPerBar(next.time_signature));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [songId]);

  const saveTempo = useCallback(
    async (nextBpm: number): Promise<boolean> => {
      if (!songId) return false;
      const clamped = clampBpm(nextBpm);
      const previous = bpm;
      setBpm(clamped); // optimistic — the local metronome updates instantly
      try {
        await updateSongTempo(songId, clamped);
        return true;
      } catch {
        setBpm(previous); // the server declined; roll back honestly
        return false;
      }
    },
    [songId, bpm],
  );

  return { bpm, beatsPerBar, canEdit, loading, saveTempo };
}
