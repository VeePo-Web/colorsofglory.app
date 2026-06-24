// Pure client-side recall across the memory graph — no backend, no embeddings.
//
// The F33 North Star CTA is "Search Memory", and the competitive audit's
// strongest lesson is that on a phone the payoff of a knowledge graph is
// finding/resurfacing, not staring at clusters. This is that recall layer:
// an instant substring search over songs, themes, scripture, people, and
// the user's own idea fragments. Deterministic and fully unit-testable.

import type { MemoryCluster, MemoryGraph, MemoryRawBundle } from "./memoryTypes";

export type MemoryHitKind = "song" | "theme" | "scripture" | "person" | "idea";

export interface MemorySearchHit {
  kind: MemoryHitKind;
  /** Unique id (song id, cluster id, or idea id). */
  id: string;
  /** Primary text shown in the row. */
  label: string;
  /** Secondary context, e.g. "3 songs" or the parent song title. */
  sublabel: string | null;
  /** Navigation target for song/idea hits. */
  songId: string | null;
  /** Source cluster for theme/scripture/person hits (opens the source sheet). */
  cluster: MemoryCluster | null;
}

export interface MemorySearchResults {
  query: string;
  songs: MemorySearchHit[];
  themes: MemorySearchHit[];
  scriptures: MemorySearchHit[];
  people: MemorySearchHit[];
  ideas: MemorySearchHit[];
  total: number;
}

const PER_GROUP = 8;

function truncate(value: string, max = 64): string {
  const v = value.trim().replace(/\s+/g, " ");
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

const empty = (query: string): MemorySearchResults => ({
  query,
  songs: [],
  themes: [],
  scriptures: [],
  people: [],
  ideas: [],
  total: 0,
});

function clusterHits(clusters: MemoryCluster[], needle: string): MemorySearchHit[] {
  return clusters
    .filter((c) => c.label.toLowerCase().includes(needle) || c.rawLabel.toLowerCase().includes(needle))
    .slice(0, PER_GROUP)
    .map((c) => ({
      kind: c.type,
      id: c.id,
      label: c.label,
      sublabel: `${c.count} ${c.count === 1 ? "song" : "songs"}`,
      songId: null,
      cluster: c,
    }));
}

/** Search the memory graph. Empty/whitespace query returns no hits. */
export function searchMemory(
  graph: MemoryGraph,
  bundle: MemoryRawBundle,
  rawQuery: string,
): MemorySearchResults {
  const needle = rawQuery.trim().toLowerCase();
  if (!needle) return empty(rawQuery);

  const songTitle = new Map(graph.songs.map((s) => [s.id, s.title]));

  const songs: MemorySearchHit[] = graph.songs
    .filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        s.tags.some((t) => t.toLowerCase().includes(needle)),
    )
    .slice(0, PER_GROUP)
    .map((s) => ({ kind: "song", id: s.id, label: s.title, sublabel: null, songId: s.id, cluster: null }));

  const ideas: MemorySearchHit[] = bundle.ideas
    .filter((i) => {
      const hay = [i.title ?? "", i.lyricSnippet ?? "", i.scriptureRef ?? "", ...(i.tags ?? [])]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    })
    .slice(0, PER_GROUP)
    .map((i) => ({
      kind: "idea" as const,
      id: i.id,
      label: truncate(i.title || i.lyricSnippet || "Idea"),
      sublabel: songTitle.get(i.songId) ?? null,
      songId: i.songId,
      cluster: null,
    }));

  const themes = clusterHits(graph.themes, needle);
  const scriptures = clusterHits(graph.scriptures, needle);
  const people = clusterHits(graph.people, needle);

  return {
    query: rawQuery,
    songs,
    themes,
    scriptures,
    people,
    ideas,
    total: songs.length + themes.length + scriptures.length + people.length + ideas.length,
  };
}
