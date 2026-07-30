/**
 * R37 — "Try it another way"
 *
 * A writer wants a second arrangement without risking the one that already
 * works. One call makes a clean copy of the song (parts, words, chords) into a
 * new room they own. Recordings are deliberately NOT copied — takes belong to
 * the moment they were sung.
 */
import { supabase } from "@/integrations/supabase/client";

export type DuplicateResult =
  | { status: "created"; song_id: string; title: string; sections: number }
  | { status: "limit_reached" };

export async function duplicateSong(
  songId: string,
  title?: string,
): Promise<DuplicateResult> {
  const { data, error } = await (supabase as any).rpc("duplicate_song", {
    _song_id: songId,
    _title: title ?? null,
  });
  if (error) throw error;
  return data as DuplicateResult;
}

/** Default name shown in the copy field — pre-selected so it's one tap to change. */
export function suggestedCopyTitle(title: string): string {
  return /\(copy\)$/i.test(title.trim()) ? title : `${title} (copy)`;
}
