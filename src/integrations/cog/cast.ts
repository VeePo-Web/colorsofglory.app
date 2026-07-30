/**
 * R52 — "One person, one colour, everywhere. Every note lives where it's about."
 *
 * Two laws from the collaboration reference standard (Figma / Docs / Splice),
 * finally given a backend:
 *
 *  1. **Identity is stable.** `getSongCast` returns every person in the song
 *     with a colour SLOT derived from join order on the server — so the same
 *     writer is the same colour on every device, in presence, in edit marks,
 *     in pins and on takes. The old client-side hash (`getCreatorColor`) could
 *     silently give two people the same hue; a slot cannot.
 *  2. **Conversation is anchored.** `getSongAnchors` returns every open
 *     suggestion and every note as a MARKER on the thing it is about — a lyric
 *     line, a millisecond inside a take, or a section — colour already bound,
 *     in ONE request. No N+1, no detached comment list.
 */
import { supabase } from "@/integrations/supabase/client";
import { AURORA_COLORS, type CreatorColor } from "@/lib/canvas/creatorColors";
import { toCogError } from "./errors";

const SLOTS = Object.keys(AURORA_COLORS);

/** The colour for a server-assigned slot. Deterministic, never hashed. */
export function colorForSlot(colorIndex: number): CreatorColor {
  return AURORA_COLORS[SLOTS[Math.abs(colorIndex) % SLOTS.length]];
}

export type CastMember = {
  user_id: string;
  display_name: string;
  initials: string;
  avatar_url: string | null;
  role: string;
  color_index: number;
  is_you: boolean;
  joined_at: string;
};

export type LineAnchor = {
  section_id: string;
  line_id: string;
  kind: "suggestion";
  count: number;
  author_user_id: string;
  color_index: number;
  author_name: string;
  first_at: string;
};

export type MomentAnchor = {
  note_id: string;
  take_id: string;
  at_ms: number;
  author_user_id: string;
  color_index: number;
  author_name: string;
  preview: string;
};

export type SectionAnchor = {
  section_id: string;
  count: number;
  latest_at: string;
};

export type SongAnchors = {
  lines: LineAnchor[];
  moments: MomentAnchor[];
  sections: SectionAnchor[];
};

const EMPTY: SongAnchors = { lines: [], moments: [], sections: [] };

export async function getSongCast(song_id: string): Promise<CastMember[]> {
  const { data, error } = await (supabase as any).rpc("song_cast", { _song_id: song_id });
  if (error) throw toCogError(error);
  return (data ?? []) as CastMember[];
}

export async function getSongAnchors(song_id: string): Promise<SongAnchors> {
  const { data, error } = await (supabase as any).rpc("song_anchors", { _song_id: song_id });
  if (error) throw toCogError(error);
  return { ...EMPTY, ...((data ?? {}) as Partial<SongAnchors>) };
}

/** userId → colour + name, for painting anyone anywhere in one lookup. */
export function castIndex(cast: CastMember[]): Map<string, CastMember> {
  return new Map(cast.map((m) => [m.user_id, m]));
}

/** `${section_id}:${line_id}` → anchor, for O(1) lookup while rendering lines. */
export function lineAnchorIndex(anchors: SongAnchors): Map<string, LineAnchor> {
  return new Map(anchors.lines.map((a) => [`${a.section_id}:${a.line_id}`, a]));
}

/** take_id → its pins, already sorted by position in the take. */
export function momentsByTake(anchors: SongAnchors): Map<string, MomentAnchor[]> {
  const out = new Map<string, MomentAnchor[]>();
  for (const m of anchors.moments) {
    const list = out.get(m.take_id);
    if (list) list.push(m);
    else out.set(m.take_id, [m]);
  }
  return out;
}

/** section_id → unresolved note count, for the calm section marker. */
export function sectionNoteCounts(anchors: SongAnchors): Map<string, number> {
  return new Map(anchors.sections.map((s) => [s.section_id, s.count]));
}