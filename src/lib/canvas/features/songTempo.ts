import { supabase } from "@/integrations/supabase/client";

/**
 * INTERIM ADAPTER — persisting the song's tempo belongs to A3/A4 (an
 * `updateSong` / `updateSongTempo` mutation is filed in
 * docs/CANVAS-FEATURES-CONTRACT.md). Until that lands, this writes tempo_bpm
 * directly, mirroring the direct-table pattern in integrations/cog/canvas.ts.
 * Non-fatal on failure: the metronome keeps clicking at the local BPM.
 */
export async function persistSongTempo(songId: string, bpm: number): Promise<void> {
  try {
    await (supabase as unknown as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => PromiseLike<unknown> };
      };
    })
      .from("songs")
      .update({ tempo_bpm: bpm })
      .eq("id", songId);
  } catch {
    /* offline / RLS — keep the local tempo, retry on next change */
  }
}
