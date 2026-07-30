/**
 * CALL THE PART WHAT YOU CALL IT (R49).
 *
 * Rooms speak in real words — "the big chorus", "Mum's part", "the tag we
 * always forget". The room only speaks in "Verse 2". When the label on screen
 * doesn't match the words in the room, people stop trusting the structure and
 * go back to describing sections in messages.
 *
 * Pure data-access + pure display helpers. No React, no toast, no UI.
 */

import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";
import type { Database } from "@/integrations/supabase/types";

export type SectionKind = Database["public"]["Enums"]["section_kind"];
export type SongSection = Database["public"]["Tables"]["song_sections"]["Row"];

const KIND_WORDS: Record<string, string> = {
  verse: "Verse",
  chorus: "Chorus",
  pre_chorus: "Pre-Chorus",
  bridge: "Bridge",
  intro: "Intro",
  outro: "Outro",
  hook: "Hook",
  tag: "Tag",
  other: "Part",
};

/** The kinds offered when changing what a part is — in the order people think of them. */
export const KIND_CHOICES: SectionKind[] = [
  "verse",
  "pre_chorus",
  "chorus",
  "bridge",
  "hook",
  "tag",
  "intro",
  "outro",
  "other",
] as SectionKind[];

/** "Chorus", "Verse", "Tag" — the plain word for a kind. */
export function kindWord(kind: string): string {
  return KIND_WORDS[kind] ?? "Part";
}

/**
 * What the section header shows. A custom label always wins. Otherwise the kind
 * plus its number *among sections of the same kind* — so a song reads
 * "Verse 1 / Chorus / Verse 2", never "Verse 1 / Chorus 2 / Verse 3".
 */
export function sectionTitle(section: SongSection, all: SongSection[]): string {
  const custom = (section.label ?? "").trim();
  if (custom) return custom;
  const sameKind = all
    .filter((s) => s.kind === section.kind)
    .sort((a, b) => a.position - b.position);
  const word = kindWord(section.kind as string);
  if (sameKind.length <= 1) return word;
  const n = sameKind.findIndex((s) => s.id === section.id) + 1;
  return `${word} ${n}`;
}

/** The greyed placeholder in the rename field — the name it would fall back to. */
export function defaultTitle(section: SongSection, all: SongSection[]): string {
  return sectionTitle({ ...section, label: null }, all);
}

/**
 * Rename a part. Pass an empty string to clear the custom name and fall back to
 * the default. Pass `kind` to also change what kind of part it is.
 */
export async function renameSection(
  sectionId: string,
  label: string,
  kind?: SectionKind,
): Promise<SongSection> {
  const { data, error } = await supabase.rpc("rename_song_section", {
    _section_id: sectionId,
    _label: label.trim().slice(0, 60),
    _kind: kind ?? undefined,
  });
  if (error) throw toCogError(error);
  return data as unknown as SongSection;
}

/** True when the writer has given this part their own words. */
export function hasCustomName(section: SongSection): boolean {
  return Boolean((section.label ?? "").trim());
}
