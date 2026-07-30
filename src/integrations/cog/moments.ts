/**
 * MOMENT NOTES (R46) — a note pinned to a point inside a recording.
 *
 * One goal of the room: feedback should land where the music is, not in a pile.
 * A moment note says "here, at 0:14" instead of "somewhere in this song".
 *
 * Pure data-access. No React, no toast, no UI.
 */

import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

export type MomentNote = {
  id: string;
  at_ms: number | null;
  body: string;
  author_user_id: string;
  resolved_at: string | null;
  created_at: string;
};

/** Pin a note to a moment in a take. `atMs` is clamped to >= 0 server-side. */
export async function addMomentNote(
  takeId: string,
  atMs: number,
  body: string,
): Promise<MomentNote> {
  const { data, error } = await supabase.rpc("add_moment_note", {
    _take_id: takeId,
    _at_ms: Math.max(0, Math.round(atMs)),
    _body: body.trim(),
  });
  if (error) throw toCogError(error);
  const row = data as unknown as MomentNote;
  return row;
}

/** All moment notes for one take, already ordered by time. */
export async function listMomentNotes(takeId: string): Promise<MomentNote[]> {
  const { data, error } = await supabase.rpc("take_moment_notes", { _take_id: takeId });
  if (error) throw toCogError(error);
  return (data ?? []) as MomentNote[];
}

/** "0:14" — the only time format the room ever shows. */
export function stamp(ms: number | null | undefined): string {
  const total = Math.max(0, Math.round((ms ?? 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Position 0..1 along a waveform for a marker dot. */
export function markerPosition(atMs: number | null, durationMs: number | null | undefined): number {
  if (!durationMs || durationMs <= 0 || atMs == null) return 0;
  return Math.min(1, Math.max(0, atMs / durationMs));
}

/**
 * The note whose moment the playhead is currently sitting on (within `windowMs`).
 * Pure + O(n) — safe to call on every timeupdate tick.
 */
export function activeMomentNote(
  notes: MomentNote[],
  playheadMs: number,
  windowMs = 1500,
): MomentNote | null {
  let best: MomentNote | null = null;
  let bestDelta = windowMs;
  for (const n of notes) {
    if (n.at_ms == null) continue;
    const delta = Math.abs(n.at_ms - playheadMs);
    if (delta <= bestDelta) {
      best = n;
      bestDelta = delta;
    }
  }
  return best;
}

/** Calm one-liner for a card footer: "2 notes inside · first at 0:14". */
export function momentsLine(notes: MomentNote[]): string | null {
  const open = notes.filter((n) => !n.resolved_at);
  if (open.length === 0) return null;
  const first = open.find((n) => n.at_ms != null);
  const count = `${open.length} ${open.length === 1 ? "note" : "notes"} inside`;
  return first ? `${count} · first at ${stamp(first.at_ms)}` : count;
}
