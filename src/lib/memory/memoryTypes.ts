// Personal Memory Graph / Zettelkasten (Feature 33) — shared types.
//
// The memory graph is built ENTIRELY from data the user already owns
// (songs they're a member of and the ideas/notes/people inside them).
// v1 needs no new tables: the raw rows below are fetched read-only and
// reduced into clusters in pure functions (buildMemoryGraph) so the whole
// thing is cheap, testable, and private by construction.

export type MemoryClusterType = "theme" | "scripture" | "person";

/** A song the user can see, flattened for memory aggregation. */
export interface MemorySong {
  id: string;
  title: string;
  coverColor: string | null;
  status: string;
  keySignature: string | null;
  tempoBpm: number | null;
  tags: string[];
  createdAt: string;
  lastActivityAt: string | null;
}

export interface MemorySection {
  id: string;
  songId: string;
  kind: string;
  label: string | null;
  position: number;
}

export interface MemoryNote {
  id: string;
  songId: string;
  body: string;
  sectionId: string | null;
}

export interface MemoryIdea {
  id: string;
  songId: string;
  title: string | null;
  lyricSnippet: string | null;
  scriptureRef: string | null;
  tags: string[];
}

export interface MemoryPerson {
  songId: string;
  userId: string;
  role: string;
  name: string;
  initials: string;
  color: string | null;
}

export interface MemoryVoiceMemo {
  id: string;
  songId: string;
  title: string | null;
}

/** A section's lyric body (one row per section in song_lyrics). */
export interface MemoryLyric {
  songId: string;
  sectionId: string;
  text: string;
}

/** Everything fetched read-only from Supabase, before reduction. */
export interface MemoryRawBundle {
  userId: string;
  songs: MemorySong[];
  sections: MemorySection[];
  notes: MemoryNote[];
  ideas: MemoryIdea[];
  people: MemoryPerson[];
  voiceMemos: MemoryVoiceMemo[];
  /** Optional so existing bundle literals/tests stay valid; defaults to []. */
  lyrics?: MemoryLyric[];
}

/**
 * A recurring thread across the catalog — a theme, a scripture, or a
 * collaborator that connects two or more songs. This is the mobile-first
 * unit of the Memory surface (cluster cards), NOT a node graph.
 */
export interface MemoryCluster {
  id: string;
  type: MemoryClusterType;
  /** Display label, e.g. "Grace", "Psalm 23", "Sarah". */
  label: string;
  /** Original/raw value before sanitising (for Obsidian aliases). */
  rawLabel: string;
  songIds: string[];
  count: number;
  /** Appears in 2+ songs — the meaningful, "this keeps coming back" signal. */
  recurring: boolean;
  /** Person colour (person clusters only). */
  color: string | null;
}

export interface MemoryStats {
  songCount: number;
  themeCount: number;
  scriptureCount: number;
  personCount: number;
  ideaCount: number;
}

export interface MemoryGraph {
  userId: string;
  songs: MemorySong[];
  themes: MemoryCluster[];
  scriptures: MemoryCluster[];
  people: MemoryCluster[];
  /** All clusters, recurring first then by reach — for the Memory Home feed. */
  clusters: MemoryCluster[];
  stats: MemoryStats;
}

/** A single song's view of the graph (for /songs/:id/memory). */
export interface RelatedSong {
  songId: string;
  title: string;
  coverColor: string | null;
  /** Plain-language reasons, e.g. ["Shares Grace", "Both use Psalm 23"]. */
  reasons: string[];
}

export interface SongMemory {
  song: MemorySong;
  themes: MemoryCluster[];
  scriptures: MemoryCluster[];
  people: MemoryCluster[];
  related: RelatedSong[];
}
