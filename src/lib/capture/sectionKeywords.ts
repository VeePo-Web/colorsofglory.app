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
  /**
   * Try to absorb a following ordinal/variant token into the marker
   * ("verse 1", "chorus 2", "verse 1a"). Defaults to true so *every* section
   * can be numbered by voice, not just the verse.
   */
  takesOrdinal?: boolean;
  /** Fixed ordinal baked into the phrase ("first verse" → 1). */
  fixedOrdinal?: number;
}

// Order matters — longer phrases win, so list multi-word rules first.
// Synonyms map a spoken word onto the canonical section kind a songwriter means
// ("ending" → outro, "refrain" → chorus, "vamp" → tag, "turnaround" → bridge),
// so the routing follows intent rather than exact vocabulary.
const RULES: KeywordRule[] = [
  { tokens: ["pre", "chorus"], kind: "pre-chorus" },
  { tokens: ["pre-chorus"], kind: "pre-chorus" },
  { tokens: ["post", "chorus"], kind: "chorus" },
  { tokens: ["first", "verse"], kind: "verse", takesOrdinal: false, fixedOrdinal: 1 },
  { tokens: ["second", "verse"], kind: "verse", takesOrdinal: false, fixedOrdinal: 2 },
  { tokens: ["third", "verse"], kind: "verse", takesOrdinal: false, fixedOrdinal: 3 },
  { tokens: ["verse"], kind: "verse" },
  { tokens: ["chorus"], kind: "chorus" },
  { tokens: ["refrain"], kind: "chorus" },
  { tokens: ["hook"], kind: "hook" },
  { tokens: ["bridge"], kind: "bridge" },
  { tokens: ["turnaround"], kind: "bridge" },
  { tokens: ["intro"], kind: "intro" },
  { tokens: ["outro"], kind: "outro" },
  { tokens: ["ending"], kind: "outro" },
  { tokens: ["coda"], kind: "outro" },
  { tokens: ["tag"], kind: "tag" },
  { tokens: ["vamp"], kind: "tag" },
  { tokens: ["interlude"], kind: "interlude" },
  { tokens: ["breakdown"], kind: "interlude" },
];

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
  return ORDINAL_WORDS[token];
}

interface OrdinalVariant {
  ordinal?: number;
  variant?: string;
  /** How many tokens (after the section phrase) were consumed. */
  consumed: number;
}

/**
 * Read an optional ordinal and/or letter variant immediately after a section
 * phrase. Handles the spoken forms a songwriter actually uses:
 *   "verse one"     → { ordinal: 1 }
 *   "verse 2"       → { ordinal: 2 }
 *   "verse 1a"      → { ordinal: 1, variant: "A" }   (one fused token)
 *   "verse 1 b"     → { ordinal: 1, variant: "B" }   (number then letter)
 *   "chorus 2"      → { ordinal: 2 }
 * A bare trailing letter is only treated as a variant when it follows a number
 * AND is b–e — never a lone "a", which is far more often the article ("verse a
 * morning…") than a variant.
 */
function consumeOrdinalVariant(
  tokens: string[],
  at: number,
): OrdinalVariant {
  const t0 = tokens[at];
  if (!t0) return { consumed: 0 };

  // Fused number+letter, e.g. "1a" / "2b".
  const fused = /^(\d{1,2})([a-h])$/.exec(t0);
  if (fused) {
    const ordinal = Number(fused[1]);
    if (ordinal > 0 && ordinal < 20) {
      return { ordinal, variant: fused[2].toUpperCase(), consumed: 1 };
    }
  }

  const ordinal = parseOrdinal(t0);
  if (ordinal == null) return { consumed: 0 };

  // Optional standalone variant letter right after the number.
  const t1 = tokens[at + 1];
  if (t1 && /^[b-e]$/.test(t1)) {
    return { ordinal, variant: t1.toUpperCase(), consumed: 2 };
  }
  return { ordinal, consumed: 1 };
}

function defaultLabel(
  kind: SectionKind,
  ordinal?: number,
  variant?: string,
): string {
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
  if (ordinal != null && variant) return `${base} ${ordinal}${variant}`;
  if (ordinal != null) return `${base} ${ordinal}`;
  if (variant) return `${base} ${variant}`;
  return base;
}

/** Pre-fill ordinals for repeated verses if none were spoken. */
function backfillVerseOrdinals(markers: SectionMarker[]): SectionMarker[] {
  let verseCount = 0;
  return markers.map((m) => {
    if (m.kind !== "verse") return m;
    verseCount += 1;
    if (m.ordinal != null) return m;
    const next = { ...m, ordinal: verseCount };
    next.label = defaultLabel("verse", verseCount, m.variant);
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
    let variant: string | undefined;
    let consumed = matched.len;
    if (matched.rule.fixedOrdinal != null) {
      // "first verse" → ordinal baked in; nothing more to absorb.
      ordinal = matched.rule.fixedOrdinal;
    } else if (matched.rule.takesOrdinal !== false) {
      // Every other section can be numbered + lettered by voice.
      const ov = consumeOrdinalVariant(tokens, i + matched.len);
      ordinal = ov.ordinal;
      variant = ov.variant;
      consumed += ov.consumed;
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
      variant,
      source: "voice",
      label: defaultLabel(matched.rule.kind, ordinal, variant),
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