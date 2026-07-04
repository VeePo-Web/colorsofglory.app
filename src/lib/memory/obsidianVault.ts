// Pure: MemoryGraph + raw bundle -> a real Obsidian-compatible Zettelkasten.
//
// A vault is just a folder of .md files. Obsidian's graph derives entirely
// from [[wikilinks]] and #tags, and it creates its own .obsidian/ config on
// open — so we ship NONE of that. We never depend on Obsidian at runtime
// (F33 hard rule); this is a portability/backup superpower, generated on
// demand in the browser at ~0 cost.
//
// Zettelkasten shape (what makes the graph a *constellation*, not a list):
//   - Every captured idea is its own ATOMIC note in Ideas/, linked out to its
//     song, its themes, and its scripture. The atomic idea is the Zettel.
//   - Song notes become hubs that link to their idea notes (not inline text).
//   - Maps of Content (All Themes / All Scripture / Collaborators / All Ideas)
//     give thumb-friendly navigation without any Dataview dependency.
//   - A "Start Here" note onboards a first-time vault opener in seconds.

import { buildSongMemory, normaliseKey, titleCase } from "./buildGraph";
import { buildInsights } from "./insights";
import type { MemoryCluster, MemoryGraph, MemoryIdea, MemoryRawBundle, MemorySong } from "./memoryTypes";

export interface VaultFile {
  path: string;
  content: string;
}

const INDEX_NOTE = "Your Memory";
const START_NOTE = "Start Here";
const MOC_THEMES = "All Themes";
const MOC_SCRIPTURE = "All Scripture";
const MOC_PEOPLE = "Collaborators";
const MOC_IDEAS = "All Ideas";
const MOC_TIMELINE = "Timeline";
const INSIGHTS_NOTE = "Insights";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-06-01T..." -> "2026-06" (or null if not a real date). */
function monthKey(value: string | null): string | null {
  if (!value) return null;
  const k = value.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(k) ? k : null;
}

/** "2026-06" -> "June 2026". */
function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`;
}

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

/** Deterministically make `base` unique against names already used. */
function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  let candidate = `${base} (${n})`;
  while (used.has(candidate)) candidate = `${base} (${++n})`;
  used.add(candidate);
  return candidate;
}

/** The unique note filename for a song id (falls back to a sanitized title). */
function songNoteName(songNames: Map<string, string>, songId: string, title: string): string {
  return songNames.get(songId) ?? sanitizeFileName(title);
}

function songWikilink(songNames: Map<string, string>, songId: string, title: string): string {
  return `[[${songNoteName(songNames, songId, title)}]]`;
}

function isoDate(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

/** Single line, trimmed, collapsed — safe for a list item or H1. */
function oneLine(value: string, max = 80): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** A captured idea's human display name (title > snippet > fallback). */
function ideaDisplayName(idea: MemoryIdea): string {
  return oneLine(idea.title?.trim() || idea.lyricSnippet?.trim() || "Idea", 64);
}

/**
 * Assign a unique, deterministic note filename to every idea. Idea titles can
 * be null or collide; a stable " (n)" suffix in bundle order keeps the vault
 * reproducible and never drops a note to a filename collision.
 */
function assignIdeaNames(ideas: MemoryIdea[]): Map<string, string> {
  const used = new Set<string>();
  const result = new Map<string, string>();
  for (const idea of ideas) result.set(idea.id, uniqueName(sanitizeFileName(ideaDisplayName(idea)), used));
  return result;
}

/**
 * Unique, deterministic note filename per song. Two untitled (or same-titled)
 * songs would otherwise both write Songs/Untitled.md — a duplicate .zip entry
 * that silently drops one song's note on extract. This makes every song note
 * survive, and every wikilink target it by its real (unique) filename.
 */
function assignSongNames(songs: MemorySong[]): Map<string, string> {
  const used = new Set<string>();
  const result = new Map<string, string>();
  for (const song of songs) result.set(song.id, uniqueName(sanitizeFileName(song.title), used));
  return result;
}

/** Theme cluster display labels that an idea's tags map to (exact graph labels). */
function ideaThemeLabels(idea: MemoryIdea): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const raw of idea.tags ?? []) {
    const key = normaliseKey(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    labels.push(titleCase(key));
  }
  return labels;
}

function buildIdeaNote(
  idea: MemoryIdea,
  song: MemorySong | undefined,
  name: string,
  songNames: Map<string, string>,
): VaultFile {
  const scripture = idea.scriptureRef?.trim() || null;
  const themeLabels = ideaThemeLabels(idea);

  const fm: string[] = ["---", "type: idea"];
  const tags = ["idea", ...(idea.tags ?? []).map(tagToken)].filter(Boolean);
  fm.push(`tags: [${[...new Set(tags)].join(", ")}]`);
  if (song) fm.push(`song: ${yamlString(songWikilink(songNames, song.id, song.title))}`);
  if (scripture) fm.push(`scripture: ${yamlString(wikilink(scripture))}`);
  fm.push("---", "");

  const body: string[] = [fm.join("\n")];
  body.push(`# ${name}`, "");

  const snippet = idea.lyricSnippet?.trim();
  if (snippet && oneLine(snippet, 64) !== name) {
    for (const line of snippet.split(/\n+/)) body.push(`> ${line.trim()}`);
    body.push("");
  }

  if (song) body.push(`**From song:** ${songWikilink(songNames, song.id, song.title)}`);
  if (scripture) body.push(`**Scripture:** ${wikilink(scripture)}`);
  if (themeLabels.length) body.push(`**Themes:** ${themeLabels.map(wikilink).join(", ")}`);
  body.push("");

  return { path: `Ideas/${name}.md`, content: body.join("\n").trimEnd() + "\n" };
}

function songFrontmatter(
  song: MemorySong,
  scriptures: string[],
  collaborators: string[],
): string {
  const lines: string[] = ["---", "type: song"];
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
  ideaNames: Map<string, string>,
  songNames: Map<string, string>,
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
  if (peopleLabels.length) {
    body.push("**Written with:** " + peopleLabels.map(wikilink).join(", "), "");
  }

  if (sections.length) {
    const lyricBySection = new Map<string, string>();
    for (const l of bundle.lyrics ?? []) {
      if (l.songId === song.id) lyricBySection.set(l.sectionId, l.text);
    }
    body.push("## Lyrics");
    for (const s of sections) {
      body.push(`### ${s.label?.trim() || s.kind}`);
      const text = lyricBySection.get(s.id)?.trim();
      if (text) {
        // Two trailing spaces = hard line break so lyric lines render verbatim.
        for (const line of text.split(/\r?\n/)) body.push(line.trim().length ? `${line}  ` : "");
      }
      body.push("");
    }
  }

  // Ideas link OUT to their own atomic notes — this is the Zettelkasten move.
  if (ideas.length) {
    body.push("## Ideas");
    for (const idea of ideas) {
      const name = ideaNames.get(idea.id);
      if (name) body.push(`- ${wikilink(name)}`);
    }
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

  if (memos.length) {
    body.push("## Voice memos");
    for (const m of memos) body.push(`- ${m.title?.trim() || "Untitled memo"}`);
    body.push("");
  }

  // Related songs — song-to-song links (the edges that make the graph dense).
  const related = buildSongMemory(graph, song.id)?.related ?? [];
  if (related.length) {
    body.push("## Related songs");
    for (const r of related.slice(0, 8)) {
      const reasons = r.reasons.length ? ` — ${r.reasons.join(", ")}` : "";
      body.push(`- ${songWikilink(songNames, r.songId, r.title)}${reasons}`);
    }
    body.push("");
  }

  return {
    path: `Songs/${songNoteName(songNames, song.id, song.title)}.md`,
    content: body.join("\n").trimEnd() + "\n",
  };
}

function buildClusterNote(
  cluster: MemoryCluster,
  graph: MemoryGraph,
  bundle: MemoryRawBundle,
  ideaNames: Map<string, string>,
  songNames: Map<string, string>,
  folder: string,
  blurb: string,
): VaultFile {
  const lines: string[] = ["---"];
  lines.push(`aliases: ${yamlList([cluster.rawLabel])}`);
  lines.push(`tags: [${cluster.type}]`);
  lines.push("---", "");
  lines.push(`# ${cluster.label}`, "");
  lines.push(blurb, "");

  lines.push("## Songs");
  for (const songId of cluster.songIds) {
    const song = graph.songs.find((s) => s.id === songId);
    if (song) lines.push(`- ${songWikilink(songNames, song.id, song.title)}`);
  }
  lines.push("");

  // Themes & scripture also gather the atomic ideas that carry them.
  if (cluster.type !== "person") {
    const key = cluster.id.slice(cluster.id.indexOf(":") + 1);
    const matching = bundle.ideas.filter((idea) => {
      if (cluster.type === "theme") {
        return (idea.tags ?? []).some((t) => normaliseKey(t) === key);
      }
      return idea.scriptureRef ? normaliseKey(idea.scriptureRef) === key : false;
    });
    if (matching.length) {
      lines.push("## Ideas");
      for (const idea of matching) {
        const name = ideaNames.get(idea.id);
        if (name) lines.push(`- ${wikilink(name)}`);
      }
      lines.push("");
    }
  }

  return { path: `${folder}/${sanitizeFileName(cluster.label)}.md`, content: lines.join("\n").trimEnd() + "\n" };
}

function buildMocNote(
  title: string,
  tag: string,
  blurb: string,
  clusters: MemoryCluster[],
): VaultFile {
  const lines: string[] = ["---", `tags: [moc, ${tag}]`, "---", ""];
  lines.push(`# ${title}`, "", blurb, "");
  if (!clusters.length) {
    lines.push("_Nothing here yet — it fills in as you write._", "");
  } else {
    for (const c of clusters) {
      const suffix = c.recurring ? ` — ${c.count} songs` : "";
      lines.push(`- ${wikilink(c.label)}${suffix}`);
    }
    lines.push("");
  }
  return { path: `${title}.md`, content: lines.join("\n").trimEnd() + "\n" };
}

function buildIdeasMoc(
  graph: MemoryGraph,
  bundle: MemoryRawBundle,
  ideaNames: Map<string, string>,
  songNames: Map<string, string>,
): VaultFile {
  const lines: string[] = ["---", "tags: [moc, ideas]", "---", ""];
  lines.push(`# ${MOC_IDEAS}`, "", "Every captured idea, grouped by the song it lives in.", "");
  for (const song of graph.songs) {
    const ideas = bundle.ideas.filter((i) => i.songId === song.id);
    if (!ideas.length) continue;
    lines.push(`## ${songWikilink(songNames, song.id, song.title)}`);
    for (const idea of ideas) {
      const name = ideaNames.get(idea.id);
      if (name) lines.push(`- ${wikilink(name)}`);
    }
    lines.push("");
  }
  if (lines.length <= 6) lines.push("_No ideas captured yet._", "");
  return { path: `${MOC_IDEAS}.md`, content: lines.join("\n").trimEnd() + "\n" };
}

/** Group songs by the month they began into dated journal notes (the time axis). */
function buildJournalNotes(graph: MemoryGraph, songNames: Map<string, string>): VaultFile[] {
  const byMonth = new Map<string, MemorySong[]>();
  for (const song of graph.songs) {
    const key = monthKey(song.createdAt);
    if (!key) continue;
    const list = byMonth.get(key) ?? [];
    list.push(song);
    byMonth.set(key, list);
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, songs]) => {
      const lines: string[] = ["---", `aliases: ${yamlList([monthLabel(key)])}`, "tags: [journal]", "---", ""];
      lines.push(`# ${monthLabel(key)}`, "");
      lines.push(`> Part of [[${MOC_TIMELINE}]].`, "");
      lines.push("## Songs started");
      for (const s of songs) lines.push(`- ${songWikilink(songNames, s.id, s.title)}`);
      lines.push("");
      return { path: `Journal/${key}.md`, content: lines.join("\n").trimEnd() + "\n" };
    });
}

/** Timeline MOC — every active month, newest first, linking its journal note. */
function buildTimelineMoc(graph: MemoryGraph): VaultFile {
  const months = new Map<string, number>();
  for (const song of graph.songs) {
    const key = monthKey(song.createdAt);
    if (key) months.set(key, (months.get(key) ?? 0) + 1);
  }
  const ordered = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const lines: string[] = ["---", "tags: [moc, timeline]", "---", ""];
  lines.push(`# ${MOC_TIMELINE}`, "", "Your songs in the order they began.", "");
  if (!ordered.length) {
    lines.push("_No songs yet — your timeline begins with your first._", "");
  } else {
    for (const [key, count] of ordered) {
      lines.push(`- [[${key}|${monthLabel(key)}]] — ${count} ${count === 1 ? "song" : "songs"}`);
    }
    lines.push("");
  }
  return { path: `${MOC_TIMELINE}.md`, content: lines.join("\n").trimEnd() + "\n" };
}

// --- JSON Canvas (jsoncanvas.org) — Obsidian opens this natively as a board.
interface CanvasNode {
  id: string;
  type: "file";
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}
interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide: "left" | "right";
  toSide: "left" | "right";
}

function clusterFolder(type: MemoryCluster["type"]): string {
  return type === "theme" ? "Themes" : type === "scripture" ? "Scriptures" : "People";
}

function clusterColor(c: MemoryCluster): string {
  // COG palette: gold for themes, warm-gray for scripture, the person's own hue.
  if (c.type === "theme") return "#B8953A";
  if (c.type === "scripture") return "#6B6459";
  return c.color || "#53AB8B";
}

/**
 * A ready-made Obsidian Canvas: songs on the left, the threads that connect
 * them (themes, scripture, collaborators) on the right, with an edge for every
 * real link. Opens with zero setup — the whole memory as one visual board.
 * Deterministic layout so the same vault always renders identically.
 */
function buildCanvas(graph: MemoryGraph, songNames: Map<string, string>): VaultFile {
  const W = 300;
  const H = 110;
  const GAP = 150;
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];

  graph.songs.forEach((song, i) => {
    nodes.push({
      id: `song:${song.id}`,
      type: "file",
      file: `Songs/${songNoteName(songNames, song.id, song.title)}.md`,
      x: -540,
      y: i * GAP,
      width: W,
      height: H,
    });
  });

  const clusters = [...graph.themes, ...graph.scriptures, ...graph.people];
  clusters.forEach((c, j) => {
    nodes.push({
      id: c.id,
      type: "file",
      file: `${clusterFolder(c.type)}/${sanitizeFileName(c.label)}.md`,
      x: 540,
      y: j * GAP,
      width: W,
      height: H,
      color: clusterColor(c),
    });
    for (const songId of c.songIds) {
      if (graph.songs.some((s) => s.id === songId)) {
        edges.push({
          id: `e:${c.id}->${songId}`,
          fromNode: `song:${songId}`,
          toNode: c.id,
          fromSide: "right",
          toSide: "left",
        });
      }
    }
  });

  return { path: "Memory Map.canvas", content: JSON.stringify({ nodes, edges }, null, 2) + "\n" };
}

/** "Your writing, by the numbers" — word/scripture/theme frequency in the vault. */
function buildInsightsNote(bundle: MemoryRawBundle): VaultFile {
  const insights = buildInsights(bundle);
  const lines: string[] = ["---", "tags: [insights]", "---", ""];
  lines.push(`# ${INSIGHTS_NOTE}`, "");
  lines.push("Your writing, by the numbers. It refreshes on every export.", "");

  const t = insights.totals;
  lines.push(
    `- Songs: ${t.songs} · Ideas: ${t.ideas} · Notes: ${t.notes} · Voice memos: ${t.voiceMemos}`,
    `- Lyric lines: ${t.lyricLines} · Words written: ${t.wordsWritten} · Vocabulary: ${t.uniqueWords} unique words`,
    "",
  );

  if (insights.topWords.length) {
    lines.push("## Words you return to");
    for (const w of insights.topWords) lines.push(`- ${w.word} — ${w.count}`);
    lines.push("");
  }

  if (insights.scriptures.length) {
    lines.push("## Scripture you lean on");
    for (const s of insights.scriptures) {
      lines.push(`- ${wikilink(s.label)} — ${s.count} ${s.count === 1 ? "mention" : "mentions"}`);
    }
    lines.push("");
  }

  if (insights.themes.length) {
    lines.push("## Themes");
    for (const th of insights.themes) lines.push(`- ${wikilink(th.label)} — ${th.count}`);
    lines.push("");
  }

  if (insights.collaborators.length) {
    lines.push("## Who you write with");
    for (const c of insights.collaborators) {
      lines.push(`- ${wikilink(c.label)} — ${c.count} ${c.count === 1 ? "song" : "songs"}`);
    }
    lines.push("");
  }

  if (insights.keys.length) {
    lines.push("## Keys you write in");
    for (const k of insights.keys) lines.push(`- ${k.label} — ${k.count} ${k.count === 1 ? "song" : "songs"}`);
    lines.push("");
  }

  if (insights.tempo) {
    const { min, max, average } = insights.tempo;
    lines.push("## Tempo");
    lines.push(min === max ? `- ${average} BPM` : `- ${min}–${max} BPM · averages ${average} BPM`);
    lines.push("");
  }

  return { path: `${INSIGHTS_NOTE}.md`, content: lines.join("\n").trimEnd() + "\n" };
}

function buildStartHereNote(graph: MemoryGraph): VaultFile {
  const lines: string[] = ["---", "tags: [colors-of-glory, guide]", "---", ""];
  lines.push(`# ${START_NOTE}`, "");
  lines.push(
    "Welcome to your Colors of Glory memory vault — every song, idea, theme, and",
    "scripture you've written, as a connected map you fully own.",
    "",
  );
  lines.push("## Explore");
  lines.push("- Open the **graph view** to see your songs and ideas as a constellation.");
  lines.push("- Open **Memory Map.canvas** for a visual board of every song and its threads.");
  lines.push(`- Start at [[${INDEX_NOTE}]] — your home index.`);
  lines.push("- Every idea is its own note, linked to its song, themes, and scripture.");
  lines.push("");
  lines.push("## Maps");
  lines.push(`- [[${INDEX_NOTE}]] — home`);
  lines.push(`- [[${MOC_IDEAS}]] — ${graph.stats.ideaCount} captured ideas`);
  lines.push(`- [[${MOC_THEMES}]] — ${graph.stats.themeCount} themes`);
  lines.push(`- [[${MOC_SCRIPTURE}]] — ${graph.stats.scriptureCount} scriptures`);
  lines.push(`- [[${MOC_PEOPLE}]] — ${graph.stats.personCount} collaborators`);
  lines.push(`- [[${MOC_TIMELINE}]] — your songs over time`);
  lines.push(`- [[${INSIGHTS_NOTE}]] — your writing, by the numbers`);
  lines.push("");
  lines.push(
    "This vault is plain Markdown. Nothing here depends on Colors of Glory —",
    "it's yours, forever.",
    "",
  );
  return { path: `${START_NOTE}.md`, content: lines.join("\n").trimEnd() + "\n" };
}

function buildIndexNote(graph: MemoryGraph, songNames: Map<string, string>): VaultFile {
  const lines: string[] = ["---"];
  lines.push(`aliases: ${yamlList(["Colors of Glory Memory"])}`);
  lines.push("tags: [colors-of-glory, memory]");
  lines.push("---", "");
  lines.push(`# ${INDEX_NOTE}`, "");
  lines.push("A private map of your songs, ideas, themes, and scripture. It grows as you write.", "");
  lines.push(`> New here? Open [[${START_NOTE}]].`, "");

  lines.push("## Maps");
  lines.push(`- [[${MOC_IDEAS}]]`);
  lines.push(`- [[${MOC_THEMES}]]`);
  lines.push(`- [[${MOC_SCRIPTURE}]]`);
  lines.push(`- [[${MOC_PEOPLE}]]`);
  lines.push(`- [[${MOC_TIMELINE}]]`);
  lines.push(`- [[${INSIGHTS_NOTE}]]`);
  lines.push("");

  lines.push(
    `- Songs: ${graph.stats.songCount}`,
    `- Ideas: ${graph.stats.ideaCount}`,
    `- Themes: ${graph.stats.themeCount}`,
    `- Scriptures: ${graph.stats.scriptureCount}`,
    `- Collaborators: ${graph.stats.personCount}`,
    "",
  );

  lines.push("## Songs");
  for (const song of graph.songs) lines.push(`- ${songWikilink(songNames, song.id, song.title)}`);
  lines.push("");

  const recurringThemes = graph.themes.filter((t) => t.recurring);
  if (recurringThemes.length) {
    lines.push("## Recurring themes");
    for (const t of recurringThemes) lines.push(`- ${wikilink(t.label)} — ${t.count} songs`);
    lines.push("");
  }
  return { path: `${INDEX_NOTE}.md`, content: lines.join("\n").trimEnd() + "\n" };
}

/**
 * Hard backstop: no two vault files ever share a path. A duplicate path in a
 * .zip silently drops a note on extract — so any distinct entities whose
 * labels sanitize identically (e.g. "Psalm 23:1" and "Psalm 23 1") get a
 * " (n)" suffix before the extension. Guarantees every note survives export.
 */
function dedupeVaultPaths(files: VaultFile[]): VaultFile[] {
  const used = new Set<string>();
  return files.map((f) => {
    if (!used.has(f.path)) {
      used.add(f.path);
      return f;
    }
    const dot = f.path.lastIndexOf(".");
    const stem = dot === -1 ? f.path : f.path.slice(0, dot);
    const ext = dot === -1 ? "" : f.path.slice(dot);
    let n = 2;
    let candidate = `${stem} (${n})${ext}`;
    while (used.has(candidate)) candidate = `${stem} (${++n})${ext}`;
    used.add(candidate);
    return { path: candidate, content: f.content };
  });
}

/** Build the full vault file set. Deterministic — safe to unit test. */
export function buildVault(graph: MemoryGraph, bundle: MemoryRawBundle): VaultFile[] {
  const ideaNames = assignIdeaNames(bundle.ideas);
  const songNames = assignSongNames(graph.songs);
  const songById = new Map(graph.songs.map((s) => [s.id, s]));

  const files: VaultFile[] = [
    buildStartHereNote(graph),
    buildIndexNote(graph, songNames),
    buildMocNote(MOC_THEMES, "themes", "Threads that keep coming back across your songs.", graph.themes),
    buildMocNote(MOC_SCRIPTURE, "scripture", "Scripture you have returned to.", graph.scriptures),
    buildMocNote(MOC_PEOPLE, "people", "Everyone you have written with.", graph.people),
    buildIdeasMoc(graph, bundle, ideaNames, songNames),
    buildTimelineMoc(graph),
    buildCanvas(graph, songNames),
    buildInsightsNote(bundle),
  ];

  files.push(...buildJournalNotes(graph, songNames));

  for (const song of graph.songs) files.push(buildSongNote(graph, bundle, song, ideaNames, songNames));

  for (const idea of bundle.ideas) {
    const name = ideaNames.get(idea.id);
    if (name) files.push(buildIdeaNote(idea, songById.get(idea.songId), name, songNames));
  }

  for (const c of graph.themes)
    files.push(buildClusterNote(c, graph, bundle, ideaNames, songNames, "Themes", "A theme across your songs."));
  for (const c of graph.scriptures)
    files.push(buildClusterNote(c, graph, bundle, ideaNames, songNames, "Scriptures", "Scripture you have returned to."));
  for (const c of graph.people)
    files.push(buildClusterNote(c, graph, bundle, ideaNames, songNames, "People", "Someone you have written with."));

  return dedupeVaultPaths(files);
}
