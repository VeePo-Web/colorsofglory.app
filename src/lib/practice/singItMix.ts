import { clampLayerGain } from "@/lib/voice/stackModel";

/**
 * singItMix — the Practice Room's per-song, device-local mix memory.
 *
 * The room seeds from the room-shared stack mix (layer_gain/layer_muted),
 * then the writer's own practice mix overrides it here — so the second
 * practice opens exactly as they mixed it, without practice ever WRITING the
 * shared rows (practice is read-only on the song; the stack sheet owns the
 * shared mix). Storage failures are silently non-fatal — the mix is comfort,
 * never a covenant.
 */

export interface SingItMix {
  gains: Record<string, number>;
  muted: string[];
}

const key = (songId: string) => `cog-sing-mix:${songId}`;

export function loadSingItMix(songId: string): SingItMix {
  try {
    const raw = localStorage.getItem(key(songId));
    if (!raw) return { gains: {}, muted: [] };
    const parsed = JSON.parse(raw) as Partial<SingItMix> | null;
    const gains: Record<string, number> = {};
    if (parsed && typeof parsed.gains === "object" && parsed.gains) {
      for (const [id, g] of Object.entries(parsed.gains)) {
        if (typeof g === "number" && Number.isFinite(g)) gains[id] = clampLayerGain(g);
      }
    }
    const muted = Array.isArray(parsed?.muted)
      ? parsed!.muted.filter((m): m is string => typeof m === "string")
      : [];
    return { gains, muted };
  } catch {
    return { gains: {}, muted: [] };
  }
}

export function saveSingItMix(songId: string, mix: SingItMix): void {
  try {
    localStorage.setItem(key(songId), JSON.stringify(mix));
  } catch {
    /* storage full/blocked — the live mix still sounds; it just won't persist */
  }
}
