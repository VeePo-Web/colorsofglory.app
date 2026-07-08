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
  const { error } = await supabase.from("song_notes").delete().eq("id", id);
  if (error) throw toCogError(error);
  if (songId) emitNoteActivity("note_removed", { song_id: songId, note_id: id });
}
