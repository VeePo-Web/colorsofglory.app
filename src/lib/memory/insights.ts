// Writing insights — "your writing, by the numbers." (Feature 33)
//
// The analytics layer of the Zettelkasten: how many times each word, each
// scripture, each theme comes back across everything the songwriter has
// written. Pure and deterministic (same bundle -> same insights), computed
// client-side from data already in the memory bundle — no backend, no AI,
// zero cost. Feeds both the in-app Memory surface and the Obsidian vault.

import { normaliseKey, titleCase } from "./buildGraph";
import type { MemoryRawBundle } from "./memoryTypes";

export interface WordCount {
  word: string;
  count: number;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface MemoryInsights {
  totals: {
    songs: number;
    ideas: number;
    notes: number;
    voiceMemos: number;
    lyricLines: number;
    /** Every word written (lyrics + idea fragments + notes), stopwords included. */
    wordsWritten: number;
    /** Distinct meaningful words — a vocabulary-richness signal. */
    uniqueWords: number;
  };
  /** Meaningful words that recur (count >= 2), most-used first. */
  topWords: WordCount[];
  /** Scripture references by number of mentions across idea captures. */
  scriptures: LabelCount[];
  /** Theme tags by number of occurrences across songs and ideas. */
  themes: LabelCount[];
  /** Collaborators by number of songs written together, most first. */
  collaborators: LabelCount[];
  /** Key signatures by number of songs written in them. */
  keys: LabelCount[];
}

// Function words that say nothing about a writer's voice. Deliberately does
// NOT filter meaning-bearing worship vocabulary (lord, grace, love, holy…) —
// those recurrences are exactly the insight.
const STOPWORDS = new Set(
  (
    "the a an and or but if then else of to in on at for with from by as is are was were be been being " +
    "am i you he she it we they me him her us them my your his hers its our their this that these those " +
    "not no nor so do does did done have has had having will would can could should shall may might must " +
    "there here when where what who whom whose which why how all any both each few more most other some " +
    "such only own same than too very just also about into over under again further once out up down off " +
    "above below between through during before after while because until although though oh ooh yeah yes " +
    "hey la na oo let lets im ive ill id youre youve youll weve well theyre dont wont cant didnt isnt arent " +
    "wasnt werent gonna wanna gotta"
  ).split(/\s+/),
);

/**
 * Lowercase word tokens; apostrophes collapse ("don't" -> "dont"). Unicode-aware
 * so worship lyrics in Spanish, Portuguese, French, etc. tokenize correctly
 * ("corazón" stays one word, not "coraz" + "n"). NFC-normalised so decomposed
 * accents (e + combining mark) count as their letter, not a word boundary.
 */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^\p{L}]+/u)
    .filter((w) => w.length >= 2);
}

function sortCounts<T extends { count: number }>(key: (t: T) => string) {
  return (a: T, b: T) => b.count - a.count || key(a).localeCompare(key(b));
}

/** Build the full insights block. Pure — safe to unit test. */
export function buildInsights(bundle: MemoryRawBundle, topN = 20): MemoryInsights {
  const lyrics = bundle.lyrics ?? [];

  // --- words ---------------------------------------------------------------
  const wordCounts = new Map<string, number>();
  let wordsWritten = 0;
  let lyricLines = 0;

  const addText = (text: string | null | undefined) => {
    if (!text) return;
    for (const token of tokenize(text)) {
      wordsWritten++;
      if (STOPWORDS.has(token)) continue;
      wordCounts.set(token, (wordCounts.get(token) ?? 0) + 1);
    }
  };

  for (const l of lyrics) {
    lyricLines += l.text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    addText(l.text);
  }
  for (const idea of bundle.ideas) addText(idea.lyricSnippet);
  for (const note of bundle.notes) addText(note.body);

  const topWords: WordCount[] = [...wordCounts.entries()]
    .map(([word, count]) => ({ word, count }))
    .filter((w) => w.count >= 2)
    .sort(sortCounts((w) => w.word))
    .slice(0, topN);

  // --- scripture mentions ----------------------------------------------------
  const scriptureCounts = new Map<string, { label: string; count: number }>();
  for (const idea of bundle.ideas) {
    const raw = idea.scriptureRef?.trim();
    if (!raw) continue;
    const key = normaliseKey(raw);
    const acc = scriptureCounts.get(key) ?? { label: raw, count: 0 };
    acc.count++;
    scriptureCounts.set(key, acc);
  }
  const scriptures: LabelCount[] = [...scriptureCounts.values()].sort(sortCounts((s) => s.label));

  // --- theme occurrences -----------------------------------------------------
  const themeCounts = new Map<string, { label: string; count: number }>();
  const addTheme = (raw: string) => {
    const key = normaliseKey(raw);
    if (!key) return;
    const acc = themeCounts.get(key) ?? { label: titleCase(key), count: 0 };
    acc.count++;
    themeCounts.set(key, acc);
  };
  for (const song of bundle.songs) for (const tag of song.tags ?? []) addTheme(tag);
  for (const idea of bundle.ideas) for (const tag of idea.tags ?? []) addTheme(tag);
  const themes: LabelCount[] = [...themeCounts.values()].sort(sortCounts((t) => t.label));

  // --- collaborators (distinct songs written together, excluding self) -------
  const collabByUser = new Map<string, { label: string; songs: Set<string> }>();
  for (const person of bundle.people) {
    if (person.userId === bundle.userId) continue;
    const acc = collabByUser.get(person.userId) ?? { label: person.name?.trim() || "Collaborator", songs: new Set<string>() };
    acc.songs.add(person.songId);
    collabByUser.set(person.userId, acc);
  }
  const collaborators: LabelCount[] = [...collabByUser.values()]
    .map((c) => ({ label: c.label, count: c.songs.size }))
    .sort(sortCounts((c) => c.label));

  // --- key signatures --------------------------------------------------------
  const keyCounts = new Map<string, { label: string; count: number }>();
  for (const song of bundle.songs) {
    const raw = song.keySignature?.trim();
    if (!raw) continue;
    const acc = keyCounts.get(raw) ?? { label: raw, count: 0 };
    acc.count++;
    keyCounts.set(raw, acc);
  }
  const keys: LabelCount[] = [...keyCounts.values()].sort(sortCounts((k) => k.label));

  return {
    totals: {
      songs: bundle.songs.length,
      ideas: bundle.ideas.length,
      notes: bundle.notes.length,
      voiceMemos: bundle.voiceMemos.length,
      lyricLines,
      wordsWritten,
      uniqueWords: wordCounts.size,
    },
    topWords,
    scriptures,
    themes,
    collaborators,
    keys,
  };
}
