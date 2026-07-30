/**
 * Song NOTES data seam (A3 · C5 lane).
 *
 * The free-form notes pad at /songs/:id/notes is backed by ONE row per note in
 * `song_notes`. This module is the ONLY place the pad talks to Supabase — no
 * component ever calls supabase.* directly.
 *
 * SONG-LEVEL ONLY: every row this module reads or writes has `section_id = NULL`.
 * Section-bound notes (section_id set) are D-group's Story/Scripture/Meaning Zone
 * and are deliberately invisible here. Same table, split by which surface renders.
 *
 * Pure data-access: no React, no toast, no UI. Errors surface as CogError so the
 * UI can render calm, recoverable copy.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CogError, toCogError } from "./errors";

/** A single song-level note, derived from the generated schema (never hand-authored). */
export type SongNote = Database["public"]["Tables"]["song_notes"]["Row"];

/**
 * Note activity contract (C5 → E-group). When a note changes we EMIT an event
 * carrying IDs + kind ONLY — never the note body (the hard "no raw content in
 * activity payloads" rule).
 *
 * DEPENDENCY: the feed is server-driven and E-group owns it. `note_added` /
 * `note_edited` / `note_removed` are NOT yet in the shared activity kind union,
 * and there is no client write path (activity is read-only from the client
 * today). Until E-group wires one — a DB trigger on song_notes, or a log RPC to
 * call here — this is a deliberate, safe no-op so a note write never depends on
 * it. When the contract lands, fill in the emit below. Do NOT ever put
 * `note.body` in the payload.
 */
export type NoteActivityKind = "note_added" | "note_edited" | "note_removed";

function emitNoteActivity(_kind: NoteActivityKind, _ids: { song_id: string; note_id: string }): void {
  // no-op until E-group publishes a client emit path / trigger (see above).
}

/**
 * All song-level notes for a song, newest first.
 * Rows bound to a section (section_id set) are excluded — those are D-group's.
 */
export async function listSongNotes(songId: string): Promise<SongNote[]> {
  const { data, error } = await supabase
    .from("song_notes")
    .select("*")
    .eq("song_id", songId)
    .is("section_id", null)
    .order("created_at", { ascending: false });
  if (error) throw toCogError(error);
  return (data ?? []) as SongNote[];
}

/**
 * Append a new song-level note. Stamps author_user_id from the signed-in user
 * (RLS also enforces this server-side — the client stamp just keeps the returned
 * row honest without a re-fetch). section_id is always NULL: C5 stays song-level.
 */
export async function addNote(songId: string, body: string): Promise<SongNote> {
  const trimmed = body.trim();
  if (!trimmed) throw new CogError("INVALID_INPUT", "A note cannot be empty.");

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new CogError("UNAUTHENTICATED");

  const { data, error } = await supabase
    .from("song_notes")
    .insert({
      song_id: songId,
      author_user_id: uid,
      body: trimmed,
      section_id: null,
    })
    .select("*")
    .single();
  if (error) throw toCogError(error);
  emitNoteActivity("note_added", { song_id: songId, note_id: data.id });
  return data as SongNote;
}

/** Edit a note's body. updated_at is set explicitly so the "edited" indicator is truthful. */
export async function updateNote(id: string, body: string): Promise<SongNote> {
  const trimmed = body.trim();
  if (!trimmed) throw new CogError("INVALID_INPUT", "A note cannot be empty.");

  const { data, error } = await supabase
    .from("song_notes")
    .update({ body: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw toCogError(error);
  emitNoteActivity("note_edited", { song_id: (data as SongNote).song_id, note_id: id });
  return data as SongNote;
}

/**
 * Remove a note. The table has no archive column, so this is a straight delete
 * (decision noted for the C5 recap). RLS restricts deletes to rows the caller
 * is allowed to remove — the SERVER is the gate.
 */
export async function removeNote(id: string, songId?: string): Promise<void> {
  // R17: soft remove — the row is hidden, not erased, so "Undo" is real.
  const { error } = await (supabase as any).rpc("archive_song_note", { _note_id: id });
  if (error) throw toCogError(error);
  if (songId) emitNoteActivity("note_removed", { song_id: songId, note_id: id });
}

/** Undo a removal (pairs with the "Removed · Undo" toast). */
export async function restoreNote(id: string): Promise<SongNote> {
  const { data, error } = await (supabase as any).rpc("restore_song_note", { _note_id: id });
  if (error) throw toCogError(error);
  return data as SongNote;
}

// ─── R17: the board (one request, authors included) ──────────────────────────

export type NoteBoardEntry = SongNote & {
  author_name: string | null;
  author_avatar_color: string | null;
};

/**
 * Every live note for a song in ONE call, with author name/colour attached and
 * archived rows already excluded. Ordering is server-decided:
 * pinned first, then open before done, then newest.
 *
 * `sectionId` omitted → song-level notes only (C5's pad).
 * `sectionId` given  → that section's notes (D-group's meaning zone).
 */
export async function listNotesBoard(
  songId: string,
  opts: { includeResolved?: boolean; sectionId?: string | null } = {},
): Promise<NoteBoardEntry[]> {
  const { data, error } = await (supabase as any).rpc("song_notes_board", {
    _song_id: songId,
    _include_resolved: opts.includeResolved ?? true,
    _section_id: opts.sectionId ?? null,
  });
  if (error) throw toCogError(error);
  return (data ?? []) as NoteBoardEntry[];
}

/** Mark a note done / not done. Write-gated server-side. */
export async function setNoteResolved(id: string, resolved: boolean): Promise<SongNote> {
  const { data, error } = await (supabase as any).rpc("set_note_resolved", {
    _note_id: id,
    _resolved: resolved,
  });
  if (error) throw toCogError(error);
  return data as SongNote;
}

/** Pin a note to the top of the pad (or unpin it). */
export async function setNotePinned(id: string, pinned: boolean): Promise<SongNote> {
  const { data, error } = await (supabase as any).rpc("set_note_pinned", {
    _note_id: id,
    _pinned: pinned,
  });
  if (error) throw toCogError(error);
  return data as SongNote;
}
