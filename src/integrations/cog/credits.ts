/**
 * CREDITS data seam (R24 · "Everyone's work is remembered").
 *
 * The credits screen is ONE request: `song_credits_board`. Contribution counts
 * are derived from real work (lyric edits, takes, ideas, notes, chord changes) —
 * never hand-entered — plus an optional short owner-written credit line.
 *
 * No lyric / note / memo content crosses this boundary. Counts and names only.
 */

import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export interface CreditPerson {
  user_id: string;
  name: string;
  avatar_url: string | null;
  avatar_color: string | null;
  role: "owner" | "collaborator" | "viewer";
  joined_at: string;
  credit_note: string | null;
  lyric_edits: number;
  takes: number;
  ideas: number;
  notes: number;
  chord_changes: number;
  first_contribution_at: string | null;
  last_contribution_at: string | null;
}

export interface CreditsBoard {
  song: { id: string; title: string; dedication: string | null; created_at: string };
  my_role: "owner" | "collaborator" | "viewer" | null;
  people: CreditPerson[];
  generated_at: string;
}

/** Everything the credits screen needs, in ONE request. */
export async function getCreditsBoard(songId: string): Promise<CreditsBoard> {
  const { data, error } = await supabase.rpc("song_credits_board", { _song_id: songId });
  if (error) throw toCogError(error);
  return data as unknown as CreditsBoard;
}

/** Owner only. Short line under a person's name (max 120 chars). Pass null to clear. */
export async function setMemberCreditNote(input: {
  songId: string;
  memberUserId: string;
  creditNote: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("set_member_credit_note", {
    _song_id: input.songId,
    _member_user_id: input.memberUserId,
    _credit_note: input.creditNote,
  });
  if (error) throw toCogError(error);
}

/** Human contribution tags derived from counts — the line under each name. */
export function contributionTags(p: CreditPerson): string[] {
  const tags: string[] = [];
  if (p.role === "owner") tags.push("Owner");
  if (p.lyric_edits > 0) tags.push("Lyrics");
  if (p.takes > 0) tags.push(p.takes === 1 ? "Voice memo" : "Voice memos");
  if (p.chord_changes > 0) tags.push("Chords");
  if (p.ideas > 0) tags.push("Ideas");
  if (p.notes > 0) tags.push("Notes");
  return tags;
}
