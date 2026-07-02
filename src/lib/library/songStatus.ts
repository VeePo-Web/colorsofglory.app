import type { SongCard as SongRow } from "@/integrations/cog/songs";

/**
 * Status chip derivation (Product Vision 11: Active · Collaborating · Draft ·
 * Archived) — computed from catalog fields only, so the chip is always true
 * to real data and never invented.
 */
export interface StatusChipSpec {
  label: "Active" | "Collaborating" | "Draft" | "Archived";
  /** Visual tone — calm, never alarming (PV11: no alert-style chips). */
  tone: "gold" | "neutral" | "quiet";
}

export function songStatusChip(song: SongRow): StatusChipSpec {
  if (song.status === "archived") return { label: "Archived", tone: "quiet" };
  if (song.collaborator_count > 1) return { label: "Collaborating", tone: "neutral" };
  if (song.voice_memo_count === 0) return { label: "Draft", tone: "quiet" };
  return { label: "Active", tone: "gold" };
}
