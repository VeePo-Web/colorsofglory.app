// Song note domain types.
//
// `SongNote` is the generated `song_notes` row. `NoteActivityKind` is the
// type-layer-owned set of note events (C5 → E-group); the DB stores kinds as
// bare strings and payloads carry IDs only — never the note body.
import type { Database } from "@/integrations/supabase/types";

export type SongNote = Database["public"]["Tables"]["song_notes"]["Row"];

export type NoteActivityKind = "note_added" | "note_edited" | "note_removed";
