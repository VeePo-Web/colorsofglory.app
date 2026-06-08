/**
 * Pure section-keyword matcher for capture transcripts.
 *
 * Detects spoken section announcements ("verse one", "chorus", "bridge"…)
 * inside a flat word stream and splits it into `TranscriptBlock`s.
 *
 * No React, no DOM, no async — safe for workers and unit tests.
 */

import type {
  SectionKind,
  SectionMarker,
  TranscriptBlock,
  TranscriptWord,
} from "./transcriptModel";

const ORDINAL_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
};

interface KeywordRule {
  /** Lowercased phrase tokens (single or multi-word). */
  tokens: string[];
  kind: SectionKind;
  /** Try to absorb a following ordinal token into the marker. */
  takesOrdinal?: boolean;
}

// Order matters — longer phrases win, so list multi-word rules first.
const RULES: KeywordRule[] = [
  { tokens: ["pre", "chorus"], kind: "pre-chorus" },
  { tokens: ["pre-chorus"], kind: "pre-chorus" },
  { tokens: ["first", "verse"], kind: "verse", takesOrdinal: false },
  { tokens: ["second", "verse"], kind: "verse", takesOrdinal: false },
  { tokens: ["third", "verse"], kind: "verse", takesOrdinal: false },
  { tokens: ["verse"], kind: "verse", takesOrdinal: true },
  { tokens: ["chorus"], kind: "chorus" },
  { tokens: ["hook"], kind: "hook" },
  { tokens: ["bridge"], kind: "bridge" },
  { tokens: ["intro"], kind: "intro" },
  { tokens: ["outro"], kind: "outro" },
  { tokens: ["tag"], kind: "tag" },
  { tokens: ["interlude"], kind: "interlude" },
];

const ORDINAL_RULES: Record<string, number> = {
  ...ORDINAL_WORDS,
  // numeric tokens: "1", "2"…
};

/**
 * Filler tokens we'll silently consume *before* a marker phrase. Lets users
 * say things like "okay chorus", "and now the bridge", "this is verse two"
 * without leaking those words into the section body.
 */
const LEADING_FILLERS = new Set<string>([
  "okay", "ok", "alright", "alrighty", "right",
  "and", "so", "now", "then",
  "this", "that", "its", "it",
  "is", "was",
  "the", "a", "an",
  "lets", "let", "us",
  "going", "to", "into",
  "do", "try", "play",
  "uh", "um", "like",
]);

function normalizeToken(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

function parseOrdinal(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const n = Number(token);
  if (Number.isFinite(n) && n > 0 && n < 20) return n;
  return ORDINAL_RULES[token];
}

function defaultLabel(kind: SectionKind, ordinal?: number): string {
  const base = {
    intro: "Intro",
    verse: "Verse",
    "pre-chorus": "Pre-Chorus",
    chorus: "Chorus",
    bridge: "Bridge",
    tag: "Tag",
    outro: "Outro",
    interlude: "Interlude",
    hook: "Hook",
    unlabeled: "Section",
  }[kind];
  return ordinal ? `${base} ${ordinal}` : base;
}

/** Pre-fill ordinals for repeated verses if none were spoken. */
function backfillVerseOrdinals(markers: SectionMarker[]): SectionMarker[] {
  let verseCount = 0;
  return markers.map((m) => {
    if (m.kind !== "verse") return m;
    verseCount += 1;
    if (m.ordinal != null) return m;
    const next = { ...m, ordinal: verseCount };
    next.label = defaultLabel("verse", verseCount);
    return next;
  });
}

/**
 * Scan a word stream and emit section markers wherever a trigger phrase appears.
 * Manual markers (chip taps) supplied via `manualMarkers` always win when their
 * timestamps are within ±400ms of a voice-detected marker.
 */
export function detectSectionMarkers(
  words: TranscriptWord[],
  manualMarkers: SectionMarker[] = [],
): SectionMarker[] {
  const tokens = words.map((w) => normalizeToken(w.text));
  const found: SectionMarker[] = [];

  let i = 0;
  while (i < tokens.length) {
    let matched: { rule: KeywordRule; len: number } | null = null;
    for (const rule of RULES) {
      const slice = tokens.slice(i, i + rule.tokens.length).join(" ");
      if (slice === rule.tokens.join(" ")) {
        matched = { rule, len: rule.tokens.length };
        break;
      }
    }
    if (!matched) {
      i += 1;
      continue;
    }

    const startWord = words[i];
    let ordinal: number | undefined;
    let consumed = matched.len;
    if (matched.rule.takesOrdinal) {
      ordinal = parseOrdinal(tokens[i + matched.len]);
      if (ordinal != null) consumed += 1;
    } else if (matched.rule.tokens[0] in ORDINAL_RULES) {
      ordinal = ORDINAL_RULES[matched.rule.tokens[0]];
    }

    // Walk backwards over leading-filler tokens so the marker absorbs them.
    let phraseStart = i;
    while (
      phraseStart > 0 &&
      LEADING_FILLERS.has(tokens[phraseStart - 1]) &&
      // Don't consume tokens that already belong to an earlier marker's body.
      (found.length === 0 || words[phraseStart - 1].startMs > (found[found.length - 1].contentStartMs ?? found[found.length - 1].atMs))
    ) {
      phraseStart -= 1;
    }

    const phraseStartWord = words[phraseStart] ?? startWord;
    const lastConsumedIdx = i + consumed - 1;
    const lastConsumedWord = words[lastConsumedIdx] ?? startWord;

    found.push({
      atMs: phraseStartWord.startMs,
      contentStartMs: lastConsumedWord.endMs,
      kind: matched.rule.kind,
      ordinal,
      source: "voice",
      label: defaultLabel(matched.rule.kind, ordinal),
    });
    i += consumed;
  }

  const merged = [...found, ...manualMarkers]
    .sort((a, b) => a.atMs - b.atMs)
    .reduce<SectionMarker[]>((acc, m) => {
      const prev = acc[acc.length - 1];
      if (prev && Math.abs(prev.atMs - m.atMs) < 400) {
        // Manual wins on conflict.
        if (m.source === "manual") acc[acc.length - 1] = m;
        return acc;
      }
      acc.push(m);
      return acc;
    }, []);

  return backfillVerseOrdinals(merged);
}

/** Split a word stream into transcript blocks using the detected markers. */
export function buildTranscriptBlocks(
  words: TranscriptWord[],
  markers: SectionMarker[],
): TranscriptBlock[] {
  const sorted = [...markers].sort((a, b) => a.atMs - b.atMs);
  const effective: SectionMarker[] = sorted.length === 0 || sorted[0].atMs > 0
    ? [
        {
          atMs: 0,
          kind: "unlabeled",
          source: "manual",
          label: "Idea",
        },
        ...sorted,
      ]
    : sorted;

  const blocks: TranscriptBlock[] = [];
  for (let idx = 0; idx < effective.length; idx += 1) {
    const marker = effective[idx];
    const nextAt = effective[idx + 1]?.atMs ?? Number.POSITIVE_INFINITY;
    // Strip the marker phrase + leading fillers from the body by using
    // contentStartMs when present.
    const bodyStart = marker.contentStartMs ?? marker.atMs;
    const blockWords = words.filter(
      (w) => w.startMs >= bodyStart && w.startMs < nextAt,
    );
    blocks.push({
      id: `block-${idx}-${marker.atMs}`,
      marker,
      words: blockWords,
      text: blockWords.map((w) => w.text).join(" "),
    });
  }
  return blocks;
}