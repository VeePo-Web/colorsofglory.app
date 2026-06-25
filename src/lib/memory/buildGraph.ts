// Pure reduction: raw bundle -> MemoryGraph. No I/O, fully unit-testable.
//
// Auto-linking is deterministic (F33 layer 1): a theme/scripture/person
// connects songs only because it literally appears in them. No AI, no
// tagging required, always explainable — which is what earns trust in a
// faith context where a wrong connection between sacred lyrics is costly.

import type {
  MemoryCluster,
  MemoryClusterType,
  MemoryGraph,
  MemoryRawBundle,
  RelatedSong,
  SongMemory,
} from "./memoryTypes";

/** Normalise a free-text key so "Grace", "grace", " GRACE " cluster together. */
export function normaliseKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Title-case a theme word for display ("grace" -> "Grace"). */
export function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface Accum {
  type: MemoryClusterType;
  rawLabel: string;
  label: string;
  songIds: Set<string>;
  color: string | null;
}

function sortClusters(a: MemoryCluster, b: MemoryCluster): number {
  if (a.recurring !== b.recurring) return a.recurring ? -1 : 1;
  if (b.count !== a.count) return b.count - a.count;
  return a.label.localeCompare(b.label);
}

export function buildMemoryGraph(bundle: MemoryRawBundle): MemoryGraph {
  const themeMap = new Map<string, Accum>();
  const scriptureMap = new Map<string, Accum>();
  const personMap = new Map<string, Accum>();

  const addTheme = (raw: string, songId: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = normaliseKey(trimmed);
    const acc =
      themeMap.get(key) ??
      { type: "theme" as const, rawLabel: trimmed, label: titleCase(key), songIds: new Set<string>(), color: null };
    acc.songIds.add(songId);
    themeMap.set(key, acc);
  };

  // Themes come from song tags AND idea-capture tags.
  for (const song of bundle.songs) {
    for (const tag of song.tags ?? []) addTheme(tag, song.id);
  }
  for (const idea of bundle.ideas) {
    if (!idea.songId) continue;
    for (const tag of idea.tags ?? []) addTheme(tag, idea.songId);
  }

  // Scriptures come from idea captures.
  for (const idea of bundle.ideas) {
    const raw = idea.scriptureRef?.trim();
    if (!raw || !idea.songId) continue;
    const key = normaliseKey(raw);
    const acc =
      scriptureMap.get(key) ??
      { type: "scripture" as const, rawLabel: raw, label: raw, songIds: new Set<string>(), color: null };
    acc.songIds.add(idea.songId);
    scriptureMap.set(key, acc);
  }

  // People = collaborators (everyone except the current user).
  for (const person of bundle.people) {
    if (person.userId === bundle.userId) continue;
    const name = person.name?.trim() || "Collaborator";
    const acc =
      personMap.get(person.userId) ??
      { type: "person" as const, rawLabel: name, label: name, songIds: new Set<string>(), color: person.color };
    acc.songIds.add(person.songId);
    if (!acc.color && person.color) acc.color = person.color;
    personMap.set(person.userId, acc);
  }

  const toClusters = (map: Map<string, Accum>, prefix: string): MemoryCluster[] =>
    [...map.entries()]
      .map(([key, acc]) => {
        const count = acc.songIds.size;
        return {
          id: `${prefix}:${key}`,
          type: acc.type,
          label: acc.label,
          rawLabel: acc.rawLabel,
          songIds: [...acc.songIds],
          count,
          recurring: count >= 2,
          color: acc.color,
        };
      })
      .sort(sortClusters);

  const themes = toClusters(themeMap, "theme");
  const scriptures = toClusters(scriptureMap, "scripture");
  const people = toClusters(personMap, "person");

  const clusters = [...themes, ...scriptures, ...people].sort(sortClusters);

  return {
    userId: bundle.userId,
    songs: bundle.songs,
    themes,
    scriptures,
    people,
    clusters,
    stats: {
      songCount: bundle.songs.length,
      themeCount: themes.length,
      scriptureCount: scriptures.length,
      personCount: people.length,
      ideaCount: bundle.ideas.length,
    },
  };
}

/** Build the single-song memory view: this song's threads + related songs. */
export function buildSongMemory(graph: MemoryGraph, songId: string): SongMemory | null {
  const song = graph.songs.find((s) => s.id === songId);
  if (!song) return null;

  const has = (c: MemoryCluster) => c.songIds.includes(songId);
  const themes = graph.themes.filter(has);
  const scriptures = graph.scriptures.filter(has);
  const people = graph.people.filter(has);

  // Related songs: any other song sharing a theme, scripture, or collaborator.
  const reasonsBySong = new Map<string, Set<string>>();
  const addReason = (cluster: MemoryCluster, verb: string) => {
    for (const other of cluster.songIds) {
      if (other === songId) continue;
      const set = reasonsBySong.get(other) ?? new Set<string>();
      set.add(`${verb} ${cluster.label}`);
      reasonsBySong.set(other, set);
    }
  };
  for (const c of themes) addReason(c, "Shares");
  for (const c of scriptures) addReason(c, "Both use");
  for (const c of people) addReason(c, "With");

  const related: RelatedSong[] = [...reasonsBySong.entries()]
    .map(([id, reasons]) => {
      const s = graph.songs.find((x) => x.id === id);
      return {
        songId: id,
        title: s?.title ?? "Untitled song",
        coverColor: s?.coverColor ?? null,
        reasons: [...reasons],
      };
    })
    .sort((a, b) => b.reasons.length - a.reasons.length || a.title.localeCompare(b.title));

  return { song, themes, scriptures, people, related };
}
