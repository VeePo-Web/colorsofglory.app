// Version history domain types.
//
// `SongVersion` is the generated `song_versions` row. The snapshot codec shapes
// (`SongSnapshotV1` / `SnapshotSection` / `SnapshotSummary`) are the rows-based,
// editor-agnostic v1 snapshot format (see docs/VERSION-CONTRACT.md). `content`
// is preserved verbatim as opaque Json so chord-anchor payloads round-trip.
import type { Database, Json } from "@/integrations/supabase/types";
// SectionKind is canonicalized in ./enums (single home); import it rather than
// re-deriving. VersionKind is also canonicalized in ./enums and reaches the
// barrel from there — not re-exported here (would duplicate the barrel export).
import type { SectionKind } from "./enums";

/** Generated row — canonical version record. */
export type SongVersion = Database["public"]["Tables"]["song_versions"]["Row"];

export type SnapshotSection = {
  id: string;
  kind: SectionKind;
  label: string | null;
  position: number;
  lyrics: { content: Json; plain_text: string } | null;
};

export type SongSnapshotV1 = {
  v: 1;
  song: { title: string | null };
  sections: SnapshotSection[];
};

export type SnapshotSummary = {
  title: string | null;
  sectionCount: number;
  lineCount: number;
  chordCount: number;
  /** Ordered section labels with per-section line counts, for the detail sheet. */
  sections: Array<{ label: string; lineCount: number }>;
  isEmpty: boolean;
};

/** Client activity kinds a version write documents for the feed (E3 → E2). */
export type VersionActivityKind = "version_saved" | "version_restored";

export type RestoreResult = {
  /** The safety snapshot of the state as it was JUST BEFORE the restore —
   *  restoring this version is Undo. */
  preRestoreVersion: SongVersion;
  /** The new restore_point version (parent = the version that was restored). */
  restoredVersion: SongVersion;
};
