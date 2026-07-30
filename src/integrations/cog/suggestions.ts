/**
 * SUGGESTIONS data seam (R26 · "Replace just this line").
 *
 * A collaborator can propose new wording for ONE lyric line without touching
 * the song. The owner accepts (the line swaps in, chords stay attached) or
 * declines. Authors can withdraw their own.
 *
 * Read is one RPC (`song_suggestions_board`). Writes are two guarded RPCs.
 * Server rules (enforced in Postgres):
 *  - read requires membership; create/resolve require owner/collaborator
 *  - accept applies the line atomically and clamps chord anchors to the new text
 *  - every action is activity-logged with IDs only, never lyric content
 */

import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export type SuggestionStatus = "open" | "accepted" | "declined" | "withdrawn";
export type SuggestionAction = "accept" | "decline" | "withdraw";

export interface LyricSuggestion {
  id: string;
  section_id: string;
  section_label: string;
  section_position: number;
  line_id: string;
  original_text: string;
  suggested_text: string;
  note: string | null;
  status: SuggestionStatus;
  author_user_id: string;
  author_name: string | null;
  author_avatar_url: string | null;
  author_avatar_color: string | null;
  is_mine: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface SuggestionsBoard {
  song_id: string;
  role: "owner" | "collaborator" | "viewer" | null;
  open_count: number;
  suggestions: LyricSuggestion[];
}

/** Load suggestions in one request. Open-only by default. */
export async function getSuggestionsBoard(
  songId: string,
  includeResolved = false,
): Promise<SuggestionsBoard> {
  const { data, error } = await supabase.rpc("song_suggestions_board", {
    _song_id: songId,
    _include_resolved: includeResolved,
  });
  if (error) throw toCogError(error);
  const board = (data ?? {}) as unknown as SuggestionsBoard;
  return {
    song_id: songId,
    role: board.role ?? null,
    open_count: board.open_count ?? 0,
    suggestions: board.suggestions ?? [],
  };
}

/** Propose a replacement for one line. Returns the new suggestion id. */
export async function createLyricSuggestion(input: {
  sectionId: string;
  lineId: string;
  suggestedText: string;
  note?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_lyric_suggestion", {
    _section_id: input.sectionId,
    _line_id: input.lineId,
    _suggested_text: input.suggestedText,
    _note: input.note ?? null,
  });
  if (error) throw toCogError(error);
  return data as unknown as string;
}

/** Accept (applies the line), decline, or withdraw your own. */
export async function resolveLyricSuggestion(
  suggestionId: string,
  action: SuggestionAction,
): Promise<{ id: string; action: SuggestionAction; applied: boolean }> {
  const { data, error } = await supabase.rpc("resolve_lyric_suggestion", {
    _suggestion_id: suggestionId,
    _action: action,
  });
  if (error) throw toCogError(error);
  return data as unknown as { id: string; action: SuggestionAction; applied: boolean };
}

/** Suggestions keyed by line id — for painting the gold dot in the sheet. */
export function byLine(suggestions: LyricSuggestion[]): Map<string, LyricSuggestion[]> {
  const map = new Map<string, LyricSuggestion[]>();
  for (const s of suggestions) {
    const list = map.get(s.line_id) ?? [];
    list.push(s);
    map.set(s.line_id, list);
  }
  return map;
}