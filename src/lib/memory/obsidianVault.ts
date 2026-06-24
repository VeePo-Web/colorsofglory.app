// Pure: MemoryGraph + raw bundle -> a real Obsidian-compatible vault.
//
// A vault is just a folder of .md files. Obsidian's graph derives entirely
// from [[wikilinks]] and #tags, and it creates its own .obsidian/ config on
// open — so we ship NONE of that. We never depend on Obsidian at runtime
// (F33 hard rule); this is a portability/backup superpower, generated on
// demand in the browser at ~0 cost.

import type { MemoryCluster, MemoryGraph, MemoryRawBundle, MemorySong } from "./memoryTypes";

export interface VaultFile {
  path: string;
  content: string;
}

const INDEX_NOTE = "Your Memory";

/** Strip filesystem/Obsidian-illegal chars; keep human-readable spaces. */
export function sanitizeFileName(name: string): string {
  const cleaned = (name || "Untitled")
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Untitled";
}

/** Kebab token usable as an Obsidian #tag (no spaces, safe chars only). */
export function tagToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function yamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function yamlList(values: string[]): string {
  if (values.length === 0) return "[]";
  return `[${values.map(yamlString).join(", ")}]`;
}

function wikilink(label: string): string {
  return `[[${sanitizeFileName(label)}]]`;
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function songFrontmatter(
  song: MemorySong,
  scriptures: string[],
  collaborators: string[],
): string {
  const lines: string[] = ["---"];
  lines.push(`title: ${yamlString(song.title)}`);
  lines.push(`aliases: ${yamlList([song.title])}`);
  const tags = ["song", ...song.tags.map(tagToken)].filter(Boolean);
  lines.push(`tags: [${[...new Set(tags)].join(", ")}]`);
  if (song.keySignature) lines.push(`key: ${yamlString(song.keySignature)}`);
  if (song.tempoBpm != null) lines.push(`bpm: ${song.tempoBpm}`);
  lines.push(`status: ${yamlString(song.status)}`);
  const created = isoDate(song.createdAt);
  if (created) lines.push(`created: ${created}`);
  if (scriptures.length) lines.push(`scriptures: ${yamlList(scriptures.map(wikilink))}`);
  if (collaborators.length) lines.push(`collaborators: ${yamlList(collaborators.map(wikilink))}`);
  lines.push("---", "");
  return lines.join("\n");
}

function buildSongNote(
  graph: MemoryGraph,
  bundle: MemoryRawBundle,
  song: MemorySong,
): VaultFile {
  const sections = bundle.sections
    .filter((s) => s.songId === song.id)
    .sort((a, b) => a.position - b.position);
  const notes = bundle.notes.filter((n) => n.songId === song.id);
  const ideas = bundle.ideas.filter((i) => i.songId === song.id);
  const memos = bundle.voiceMemos.filter((m) => m.songId === song.id);

  const scriptureLabels = graph.scriptures
    .filter((c) => c.songIds.includes(song.id))
    .map((c) => c.label);
  const peopleLabels = graph.people
    .filter((c) => c.songIds.includes(song.id))
    .map((c) => c.label);
  const themeLabels = graph.themes
    .filter((c) => c.songIds.includes(song.id))
    .map((c) => c.label);

  const body: string[] = [];
  body.push(songFrontmatter(song, scriptureLabels, peopleLabels));
  body.push(`# ${song.title}`, "");
  body.push(`> Part of [[${INDEX_NOTE}]].`, "");

  if (themeLabels.length) {
    body.push("**Themes:** " + themeLabels.map(wikilink).join(", "), "");
  }

  if (sections.length) {
    body.push("## Sections");
    for (const s of sections) body.push(`- ${s.label?.trim() || s.kind}`);
    body.push("");
  }

  if (notes.length) {
    body.push("## Notes");
    for (const n of notes) {
      const text = n.body.trim();
      if (text) body.push(`- ${text.replace(/\n+/g, " ")}`);
    }
    body.push("");
  }

  if (ideas.length) {
    body.push("## Ideas");
    for (const idea of ideas) {
      const title = idea.title?.trim();
      const snippet = idea.lyricSnippet?.trim();
      const head = title || snippet || "Idea";
      let line = `- ${head}`;
      if (title && snippet) line += ` — ${snippet}`;
      if (idea.scriptureRef?.trim()) line += ` (${wikilink(idea.scriptureRef.trim())})`;
      const tagStr = (idea.tags ?? []).map(tagToken).filter(Boolean).map((t) => `#${t}`).join(" ");
      if (tagStr) line += ` ${tagStr}`;
      body.push(line);
    }
    body.push("");
  }

  if (memos.length) {
    body.push("## Voice memos");
    for (const m of memos) body.push(`- ${m.title?.trim() || "Untitled memo"}`);
    body.push("");
  }

  return { path: `Songs/${sanitizeFileName(song.title)}.md`, content: body.join("\n").trimEnd() + "\n" };
}

function buildClusterNote(cluster: MemoryCluster, graph: MemoryGraph, folder: string, blurb: string): VaultFile {
  const lines: string[] = ["---"];
  lines.push(`aliases: ${yamlList([cluster.rawLabel])}`);
  lines.push(`tags: [${cluster.type}]`);
  lines.push("---", "");
  lines.push(`# ${cluster.label}`, "");
  lines.push(blurb, "");
  lines.push("## Songs");
  for (const songId of cluster.songIds) {
    const song = graph.songs.find((s) => s.id === songId);
    if (song) lines.push(`- ${wikilink(song.title)}`);
  }
  lines.push("");
  return { path: `${folder}/${sanitizeFileName(cluster.label)}.md`, content: lines.join("\n").trimEnd() + "\n" };
}

function buildIndexNote(graph: MemoryGraph): VaultFile {
  const lines: string[] = ["---"];
  lines.push(`aliases: ${yamlList(["Colors of Glory Memory"])}`);
  lines.push("tags: [colors-of-glory, memory]");
  lines.push("---", "");
  lines.push(`# ${INDEX_NOTE}`, "");
  lines.push("A private map of your songs, ideas, themes, and scripture. It grows as you write.", "");
  lines.push(
    `- Songs: ${graph.stats.songCount}`,
    `- Themes: ${graph.stats.themeCount}`,
    `- Scriptures: ${graph.stats.scriptureCount}`,
    `- Collaborators: ${graph.stats.personCount}`,
    "",
  );

  lines.push("## Songs");
  for (const song of graph.songs) lines.push(`- ${wikilink(song.title)}`);
  lines.push("");

  const recurringThemes = graph.themes.filter((t) => t.recurring);
  if (recurringThemes.length) {
    lines.push("## Recurring themes");
    for (const t of recurringThemes) lines.push(`- ${wikilink(t.label)} — ${t.count} songs`);
    lines.push("");
  }
  return { path: `${INDEX_NOTE}.md`, content: lines.join("\n").trimEnd() + "\n" };
}

/** Build the full vault file set. Deterministic — safe to unit test. */
export function buildVault(graph: MemoryGraph, bundle: MemoryRawBundle): VaultFile[] {
  const files: VaultFile[] = [buildIndexNote(graph)];
  for (const song of graph.songs) files.push(buildSongNote(graph, bundle, song));
  for (const c of graph.themes) files.push(buildClusterNote(c, graph, "Themes", "A theme across your songs."));
  for (const c of graph.scriptures)
    files.push(buildClusterNote(c, graph, "Scriptures", "Scripture you have returned to."));
  for (const c of graph.people)
    files.push(buildClusterNote(c, graph, "People", "Someone you have written with."));
  return files;
}
