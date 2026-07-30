/**
 * THE SONG NAMES ITSELF (R47).
 *
 * A song that is still called "Untitled" three weeks in is a song nobody can
 * find, share, or talk about. The words are already written — the title is
 * almost always sitting inside them.
 *
 * Pure data-access + pure helpers. No React, no toast, no UI.
 */

import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export type TitleSuggestion = {
  suggestion: string;
  /** 'hook' = a repeated line, 'chorus' = first chorus line, 'opening' = first line written. */
  source: "hook" | "chorus" | "opening";
  weight: number;
};

const PLACEHOLDER = /^(untitled|new song|song|no name)\s*\d*$/i;

/** True when the song has never really been named. */
export function isUnnamed(title: string | null | undefined): boolean {
  const t = (title ?? "").trim();
  return t.length === 0 || PLACEHOLDER.test(t);
}

/** Title candidates pulled from the song's own words. Empty is a normal answer. */
export async function fetchTitleSuggestions(songId: string): Promise<TitleSuggestion[]> {
  const { data, error } = await supabase.rpc("song_title_suggestions", { _song_id: songId });
  if (error) throw toCogError(error);
  return ((data ?? []) as TitleSuggestion[]).map((s) => ({ ...s, suggestion: tidy(s.suggestion) }));
}

/** Strip trailing punctuation and collapse whitespace so a lyric reads like a title. */
export function tidy(line: string): string {
  return line
    .replace(/\s+/g, " ")
    .replace(/^["'([]+/, "")
    .replace(/["'.,;:!?)\]]+$/g, "")
    .trim();
}

/** Rename the song. Owner/writer permission is enforced by existing song policies. */
export async function renameSong(songId: string, title: string): Promise<void> {
  const next = tidy(title);
  if (!next) throw toCogError(new Error("empty_title"));
  const { error } = await supabase.from("songs").update({ title: next }).eq("id", songId);
  if (error) throw toCogError(error);
}

/** The single line the room whispers: "Call it 'Hold me steady'?" — or nothing. */
export function nameNudge(
  title: string | null | undefined,
  suggestions: TitleSuggestion[],
): string | null {
  if (!isUnnamed(title)) return null;
  const top = suggestions[0];
  if (!top) return null;
  return `Call it “${top.suggestion}”?`;
}
