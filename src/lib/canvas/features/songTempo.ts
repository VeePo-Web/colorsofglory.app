import { updateSongTempo } from "@/integrations/cog/songs";

/**
 * The `updateSongTempo` mutation this adapter was filed for (see
 * docs/CANVAS-FEATURES-CONTRACT.md) now exists on the A3 seam
 * (integrations/cog/songs) — persisting through it also propagates the shared
 * tempo live to every open room via the song-tempo realtime channel.
 * Non-fatal on failure: the metronome keeps clicking at the local BPM.
 */
export async function persistSongTempo(songId: string, bpm: number): Promise<void> {
  try {
    await updateSongTempo(songId, bpm);
  } catch {
    /* offline / RLS — keep the local tempo, retry on next change */
  }
}
