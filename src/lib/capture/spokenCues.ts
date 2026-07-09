/**
 * Spoken scripture + note cue parser for capture transcripts.
 *
 * The broader "say-it-structured" promise: one dictation lays down structure
 * AND content. Alongside sections (sectionKeywords) and key/tempo/chords
 * (musicCues), a songwriter can say:
 *
 *   "Psalm twenty three"            → a scripture cue ("Psalm 23")
 *   "first Corinthians thirteen"    → a scripture cue ("1 Corinthians 13")
 *   "John three sixteen"            → a scripture cue ("John 3:16")
 *   "note — remember the key change"→ a note cue with the spoken body
 *
 * and each lands as its own block in review (scripture routes to H1's
 * scripture lane for verse-text attach; notes become idea blocks).
 *
 * Pure data in, pure data out — no React, no DOM, no async.
 *
 * Design bias (same as musicCues): **under-detect rather than mis-detect.**
 * Ambiguous book names that double as ordinary words ("mark", "acts", "job",
 * "jude") need strong evidence — an ordinal prefix ("first John"), the word
 * "chapter", or BOTH a chapter and a verse ("John 3 16"). A wrong scripture
 * chip is worse than a missed one.
 */

import type { TranscriptWord } from "./transcriptModel";

export interface ScriptureCue {
  /** Canonical reference, e.g. "Psalm 23", "John 3:16", "1 Corinthians 13". */
  reference: string;
  atMs: number;
  endMs: number;
}

export interface NoteCue {
  /** The spoken body AFTER the trigger ("remember the key change"). */
  text: string;
  atMs: number;
  endMs: number;
}

export interface SpokenCues {
  scriptures: ScriptureCue[];
  notes: NoteCue[];
}

interface Tok {
  lower: string;
  startMs: number;
  endMs: number;
}

function toToks(words: TranscriptWord[]): Tok[] {
  return words.map((w) => ({
    // Keep ":" so a fused "3:16" token survives normalization.
    lower: w.text.toLowerCase().replace(/[^a-z0-9:]/g, ""),
    startMs: w.startMs,
    endMs: w.endMs,
  }));
}

// ---------------------------------------------------------------------------
// Spoken numbers ("twenty three", "a hundred and nineteen", "23", "3:16")
// ---------------------------------------------------------------------------

const UNITS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

interface ParsedNumber {
  value: number;
  consumed: number;
}

/** Greedy spoken/numeric number at `i` ("twenty three" reads as 23, not 20+3). */
function parseNumberAt(toks: Tok[], i: number): ParsedNumber | null {
  const t0 = toks[i]?.lower;
  if (!t0) return null;

  if (/^\d{1,3}$/.test(t0)) return { value: Number(t0), consumed: 1 };

  let value = 0;
  let consumed = 0;

  // "a hundred (and) nineteen", "one hundred twenty"
  if ((t0 === "a" || UNITS[t0] != null) && toks[i + 1]?.lower === "hundred") {
    value += (t0 === "a" ? 1 : UNITS[t0]) * 100;
    consumed = 2;
    if (toks[i + consumed]?.lower === "and") consumed += 1;
  } else if (t0 === "hundred") {
    value = 100;
    consumed = 1;
  }

  const tw = toks[i + consumed]?.lower;
  if (tw && TENS[tw] != null) {
    value += TENS[tw];
    consumed += 1;
    const ow = toks[i + consumed]?.lower;
    if (ow && UNITS[ow] != null && UNITS[ow] < 10) {
      value += UNITS[ow];
      consumed += 1;
    }
  } else if (tw && UNITS[tw] != null) {
    value += UNITS[tw];
    consumed += 1;
  }

  if (consumed === 0 || value === 0) return null;
  return { value, consumed };
}

// ---------------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------------

interface BookRule {
  /** Lowercased spoken tokens (multi-word listed before their prefixes). */
  tokens: string[];
  /** Canonical display name ("Psalm", "Song of Solomon"). */
  canonical: string;
  /**
   * The name doubles as an ordinary English word / first name ("mark",
   * "acts", "job", "john"). Needs strong evidence: an ordinal prefix, the
   * word "chapter", or chapter AND verse together.
   */
  ambiguous?: boolean;
  /** Book that exists in numbered form (1/2/3 John, 1/2 Corinthians…). */
  takesOrdinal?: boolean;
}

const BOOKS: BookRule[] = [
  { tokens: ["song", "of", "solomon"], canonical: "Song of Solomon" },
  { tokens: ["song", "of", "songs"], canonical: "Song of Solomon" },
  { tokens: ["genesis"], canonical: "Genesis" },
  { tokens: ["exodus"], canonical: "Exodus" },
  { tokens: ["leviticus"], canonical: "Leviticus" },
  { tokens: ["numbers"], canonical: "Numbers", ambiguous: true },
  { tokens: ["deuteronomy"], canonical: "Deuteronomy" },
  { tokens: ["joshua"], canonical: "Joshua" },
  { tokens: ["judges"], canonical: "Judges", ambiguous: true },
  { tokens: ["ruth"], canonical: "Ruth", ambiguous: true },
  { tokens: ["samuel"], canonical: "Samuel", takesOrdinal: true, ambiguous: true },
  { tokens: ["kings"], canonical: "Kings", takesOrdinal: true, ambiguous: true },
  { tokens: ["chronicles"], canonical: "Chronicles", takesOrdinal: true },
  { tokens: ["ezra"], canonical: "Ezra" },
  { tokens: ["nehemiah"], canonical: "Nehemiah" },
  { tokens: ["esther"], canonical: "Esther" },
  { tokens: ["job"], canonical: "Job", ambiguous: true },
  { tokens: ["psalms"], canonical: "Psalm" },
  { tokens: ["psalm"], canonical: "Psalm" },
  { tokens: ["proverbs"], canonical: "Proverbs" },
  { tokens: ["ecclesiastes"], canonical: "Ecclesiastes" },
  { tokens: ["isaiah"], canonical: "Isaiah" },
  { tokens: ["jeremiah"], canonical: "Jeremiah" },
  { tokens: ["lamentations"], canonical: "Lamentations" },
  { tokens: ["ezekiel"], canonical: "Ezekiel" },
  { tokens: ["daniel"], canonical: "Daniel", ambiguous: true },
  { tokens: ["hosea"], canonical: "Hosea" },
  { tokens: ["joel"], canonical: "Joel", ambiguous: true },
  { tokens: ["amos"], canonical: "Amos", ambiguous: true },
  { tokens: ["obadiah"], canonical: "Obadiah" },
  { tokens: ["jonah"], canonical: "Jonah" },
  { tokens: ["micah"], canonical: "Micah" },
  { tokens: ["nahum"], canonical: "Nahum" },
  { tokens: ["habakkuk"], canonical: "Habakkuk" },
  { tokens: ["zephaniah"], canonical: "Zephaniah" },
  { tokens: ["haggai"], canonical: "Haggai" },
  { tokens: ["zechariah"], canonical: "Zechariah" },
  { tokens: ["malachi"], canonical: "Malachi" },
  { tokens: ["matthew"], canonical: "Matthew" },
  { tokens: ["mark"], canonical: "Mark", ambiguous: true },
  { tokens: ["luke"], canonical: "Luke", ambiguous: true },
  { tokens: ["john"], canonical: "John", takesOrdinal: true, ambiguous: true },
  { tokens: ["acts"], canonical: "Acts", ambiguous: true },
  { tokens: ["romans"], canonical: "Romans" },
  { tokens: ["corinthians"], canonical: "Corinthians", takesOrdinal: true },
  { tokens: ["galatians"], canonical: "Galatians" },
  { tokens: ["ephesians"], canonical: "Ephesians" },
  { tokens: ["philippians"], canonical: "Philippians" },
  { tokens: ["colossians"], canonical: "Colossians" },
  { tokens: ["thessalonians"], canonical: "Thessalonians", takesOrdinal: true },
  { tokens: ["timothy"], canonical: "Timothy", takesOrdinal: true },
  { tokens: ["titus"], canonical: "Titus" },
  { tokens: ["philemon"], canonical: "Philemon" },
  { tokens: ["hebrews"], canonical: "Hebrews" },
  { tokens: ["james"], canonical: "James", ambiguous: true },
  { tokens: ["peter"], canonical: "Peter", takesOrdinal: true, ambiguous: true },
  { tokens: ["jude"], canonical: "Jude", ambiguous: true },
  { tokens: ["revelation"], canonical: "Revelation" },
  { tokens: ["revelations"], canonical: "Revelation" },
];

const ORDINAL_PREFIX: Record<string, number> = {
  first: 1, second: 2, third: 3,
  "1st": 1, "2nd": 2, "3rd": 3,
  "1": 1, "2": 2, "3": 3,
};

const MAX_CHAPTER = 150;
const MAX_VERSE = 200;

interface ChapterVerse {
  chapter: number;
  verse?: number;
  consumed: number;
  sawChapterWord: boolean;
}

/** Read "[chapter] <n> [verse|: <m>]" starting at `i`. */
function parseChapterVerse(toks: Tok[], i: number): ChapterVerse | null {
  let j = i;
  let sawChapterWord = false;
  if (toks[j]?.lower === "chapter") {
    sawChapterWord = true;
    j += 1;
  }

  // Fused "3:16".
  const fused = /^(\d{1,3}):(\d{1,3})$/.exec(toks[j]?.lower ?? "");
  if (fused) {
    const chapter = Number(fused[1]);
    const verse = Number(fused[2]);
    if (chapter >= 1 && chapter <= MAX_CHAPTER && verse >= 1 && verse <= MAX_VERSE) {
      return { chapter, verse, consumed: j - i + 1, sawChapterWord };
    }
    return null;
  }

  const ch = parseNumberAt(toks, j);
  if (!ch || ch.value < 1 || ch.value > MAX_CHAPTER) return null;
  j += ch.consumed;

  // Optional verse: "verse 16", "v 16", or a direct second number ("three sixteen").
  let verse: number | undefined;
  const connector = toks[j]?.lower;
  if (connector === "verse" || connector === "verses" || connector === "v" || connector === "vs") {
    const v = parseNumberAt(toks, j + 1);
    if (v && v.value >= 1 && v.value <= MAX_VERSE) {
      verse = v.value;
      j += 1 + v.consumed;
    }
  } else {
    const v = parseNumberAt(toks, j);
    if (v && v.value >= 1 && v.value <= MAX_VERSE) {
      verse = v.value;
      j += v.consumed;
    }
  }

  return { chapter: ch.value, verse, consumed: j - i, sawChapterWord };
}

function detectScriptures(toks: Tok[]): ScriptureCue[] {
  const cues: ScriptureCue[] = [];

  for (let i = 0; i < toks.length; ) {
    // Optional ordinal prefix ("first John", "2 Timothy").
    const ord = ORDINAL_PREFIX[toks[i]?.lower ?? ""];
    const bookAt = ord != null ? i + 1 : i;

    let book: BookRule | null = null;
    for (const rule of BOOKS) {
      const slice = toks.slice(bookAt, bookAt + rule.tokens.length).map((t) => t.lower).join(" ");
      if (slice === rule.tokens.join(" ")) {
        book = rule;
        break;
      }
    }
    if (!book || (ord != null && !book.takesOrdinal)) {
      i += 1;
      continue;
    }

    const afterBook = bookAt + book.tokens.length;
    const cv = parseChapterVerse(toks, afterBook);
    if (!cv) {
      i = afterBook;
      continue;
    }

    // Precision gate for ambiguous names: an ordinal prefix, the word
    // "chapter", or chapter AND verse together.
    const strongEvidence = ord != null || cv.sawChapterWord || cv.verse != null;
    if (book.ambiguous && !strongEvidence) {
      i = afterBook;
      continue;
    }

    const startTok = toks[ord != null ? i : bookAt];
    const endTok = toks[afterBook + cv.consumed - 1] ?? startTok;
    const name = ord != null ? `${ord} ${book.canonical}` : book.canonical;
    cues.push({
      reference: `${name} ${cv.chapter}${cv.verse != null ? `:${cv.verse}` : ""}`,
      atMs: startTok.startMs,
      endMs: endTok.endMs,
    });
    i = afterBook + cv.consumed;
  }

  // Collapse immediate repeats (the same reference re-spoken while noodling).
  return cues.filter((c, idx) => idx === 0 || c.reference !== cues[idx - 1].reference);
}

// ---------------------------------------------------------------------------
// Notes ("note — remember the key change", "make a note that…")
// ---------------------------------------------------------------------------

const NOTE_TRIGGERS = new Set(["note", "reminder"]);
/** Words allowed to lead into a note trigger without breaking command-ness. */
const NOTE_LEADINS = new Set(["a", "quick", "make", "take", "mental", "okay", "so", "and", "now"]);
/** Absorbed right after the trigger, never into the body. */
const NOTE_TRAILERS = new Set(["to", "self", "that", "this"]);

/** A note body ends at a breath this long — the writer moved on. */
const NOTE_BODY_GAP_MS = 900;
const NOTE_BODY_MAX_WORDS = 24;
/** Pause that marks the trigger as a command rather than a lyric noun. */
const NOTE_COMMAND_GAP_MS = 280;

function detectNotes(toks: Tok[]): NoteCue[] {
  const cues: NoteCue[] = [];

  for (let i = 0; i < toks.length; i += 1) {
    if (!NOTE_TRIGGERS.has(toks[i].lower)) continue;

    // Walk back over lead-ins ("make a", "quick") while continuous.
    let phraseStart = i;
    while (
      phraseStart > 0 &&
      NOTE_LEADINS.has(toks[phraseStart - 1].lower) &&
      toks[phraseStart].startMs - toks[phraseStart - 1].endMs < NOTE_COMMAND_GAP_MS * 2
    ) {
      phraseStart -= 1;
    }

    // Command gate: the phrase must start the take or follow a real breath.
    // "a love note" / "your note said" run mid-phrase and never trigger.
    const prev = toks[phraseStart - 1];
    const commandLike = !prev || toks[phraseStart].startMs - prev.endMs >= NOTE_COMMAND_GAP_MS;
    if (!commandLike) continue;

    // Absorb trailers ("to self", "that") so they never open the body.
    let bodyStart = i + 1;
    while (bodyStart < toks.length && NOTE_TRAILERS.has(toks[bodyStart].lower)) {
      bodyStart += 1;
    }
    if (bodyStart >= toks.length) continue; // trigger with no body — ignore

    // Body runs until a long breath or the cap.
    const bodyToks: Tok[] = [toks[bodyStart]];
    let j = bodyStart + 1;
    while (
      j < toks.length &&
      bodyToks.length < NOTE_BODY_MAX_WORDS &&
      toks[j].startMs - toks[j - 1].endMs < NOTE_BODY_GAP_MS
    ) {
      bodyToks.push(toks[j]);
      j += 1;
    }

    cues.push({
      text: bodyToks.map((t) => t.lower).join(" "),
      atMs: toks[phraseStart].startMs,
      endMs: bodyToks[bodyToks.length - 1].endMs,
    });
    i = j - 1;
  }

  return cues;
}

/** Extract scripture references + spoken notes from a capture transcript. */
export function detectSpokenCues(words: TranscriptWord[]): SpokenCues {
  const toks = toToks(words);
  return {
    scriptures: detectScriptures(toks),
    notes: detectNotes(toks),
  };
}
