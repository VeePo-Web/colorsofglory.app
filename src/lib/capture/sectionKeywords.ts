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
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
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
  /** Display label that beats the generated one ("Final Chorus", "Drop"). */
  labelOverride?: string;
  /**
   * "second time" — a repeat call whose section KIND comes from the previous
   * detected marker ("chorus … second time" → Chorus 2). Skipped entirely when
   * nothing precedes it, so ordinary lyrics can't trigger it cold.
   */
  repeatPrevious?: boolean;
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
  { tokens: ["last", "chorus"], kind: "chorus", takesOrdinal: false, labelOverride: "Final Chorus" },
  { tokens: ["final", "chorus"], kind: "chorus", takesOrdinal: false, labelOverride: "Final Chorus" },
  { tokens: ["double", "chorus"], kind: "chorus", takesOrdinal: false, labelOverride: "Double Chorus" },
  // "the drop" — the chorus-energy moment in modern worship/CCM writing.
  // Two-token on purpose: a bare "drop" is far too often a lyric verb.
  { tokens: ["the", "drop"], kind: "chorus", takesOrdinal: false, labelOverride: "Drop" },
  // Repeat call: "…second time…" re-announces whatever section came last.
  { tokens: ["second", "time"], kind: "verse", takesOrdinal: false, repeatPrevious: true },
  { tokens: ["verse"], kind: "verse" },
  { tokens: ["chorus"], kind: "chorus" },
  { tokens: ["refrain"], kind: "chorus" },
  { tokens: ["hook"], kind: "hook" },
  { tokens: ["bridge"], kind: "bridge" },
  { tokens: ["turnaround"], kind: "bridge" },
  { tokens: ["channel"], kind: "pre-chorus" },
  { tokens: ["intro"], kind: "intro" },
  { tokens: ["outro"], kind: "outro" },
  { tokens: ["ending"], kind: "outro" },
  { tokens: ["coda"], kind: "outro" },
  { tokens: ["tag"], kind: "tag" },
  { tokens: ["vamp"], kind: "tag" },
  { tokens: ["interlude"], kind: "interlude" },
  { tokens: ["instrumental"], kind: "interlude", labelOverride: "Instrumental" },
  { tokens: ["breakdown"], kind: "interlude" },
];

/**
 * Real-world STT mishears + plurals, normalised to the canonical keyword so a
 * sung section call still routes correctly when transcription fumbles it. Kept
 * deliberately small and high-confidence — precision matters more than recall
 * (a wrong section split is worse than a missed one). The classic "chorus" →
 * "course" mishear is handled separately below, with an "of course" guard.
 */
const TOKEN_ALIASES: Record<string, string> = {
  verses: "verse",
  choruses: "chorus",
  bridges: "bridge",
  intros: "intro",
  outros: "outro",
  hooks: "hook",
  tags: "tag",
  vamps: "vamp",
  interludes: "interlude",
  refrains: "refrain",
  endings: "ending",
  codas: "coda",
};

/**
 * Map each token to its canonical keyword form for matching. Only the keyword
 * surface is canonicalised — ordinals, fillers, and timestamps still use the
 * raw tokens, so nothing downstream shifts.
 */
function canonicalizeTokens(tokens: string[]): string[] {
  return tokens.map((t, i) => {
    // "course" is the single most common transcription of a sung "chorus" —
    // but never inside "of course", which is ordinary speech, not a section call.
    if (t === "course" && tokens[i - 1] !== "of") return "chorus";
    return TOKEN_ALIASES[t] ?? t;
  });
}

/**
 * Filler tokens we'll silently consume *before* a marker phrase. Lets users
 * say things like "okay chorus", "and now the bridge", "this is verse two"
 * without leaking those words into the section body.
 */
const LEADING_FILLERS = new Set<string>([
  "okay", "ok", "alright", "alrighty", "right",
  "and", "so", "now", "then", "next",
  "this", "that", "its", "it",
  "is", "was",
  "the", "a", "an",
  "lets", "let", "us",
  "going", "gonna", "to", "into", "onto",
  "do", "try", "play",
  "uh", "um", "like", "well",
  "here", "heres", "comes",
]);

/**
 * A filler is only absorbed into the marker phrase when it runs CONTINUOUSLY
 * into it. Across a real pause the same word is almost certainly the tail of
 * the lyric ("…I am here <pause> chorus") — absorbing it would eat a lyric
 * word, which is worse than a slightly untidy announcement.
 */
const FILLER_MAX_GAP_MS = 600;

/**
 * Words that, when they run straight into a section word with no pause, mark
 * it as part of a sung phrase rather than an announcement ("EVERY verse OF
 * this psalm", "IN the chorus of heaven").
 */
const CONTENT_PRECEDERS = new Set<string>([
  "every", "each", "that", "those", "these",
  "of", "in", "from", "with", "through",
  "your", "my", "our", "his", "her", "their",
  "whole", "same", "little", "sweet",
]);

/** Pause length that clearly separates an announcement from surrounding speech. */
const CLEAR_PAUSE_MS = 550;
/**
 * A softer but still audible breath. Continuous phrasing (words sung/spoken in
 * one flow) sits under ~150ms between words on real Whisper timings and at 0
 * on the live path's synthetic layout — so 200ms is already a deliberate gap.
 */
const SOFT_PAUSE_MS = 200;

/**
 * Markers at or above this confidence are APPLIED (they split the take).
 * Below it they are surfaced as candidates for one-tap confirmation in the
 * Review sheet — never silently applied, never silently dropped (the Dragon
 * NaturallySpeaking command-vs-content lesson).
 */
export const APPLY_CONFIDENCE_THRESHOLD = 0.5;

/** Does this marker actually split the take? Manual chips always do. */
export function isAppliedMarker(m: SectionMarker): boolean {
  if (m.source === "manual") return true;
  return (m.confidence ?? 1) >= APPLY_CONFIDENCE_THRESHOLD;
}

/** Low-confidence voice markers — flagged for review, never auto-applied. */
export function pendingCandidateMarkers(markers: SectionMarker[]): SectionMarker[] {
  return markers.filter((m) => m.source === "voice" && !isAppliedMarker(m));
}

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
  // "chorus second TIME" / "verse two ROUND"? — absorb the repeat word so it
  // never leaks into the section body.
  if (t1 === "time" && ORDINAL_WORDS[t0] != null) {
    return { ordinal, consumed: 2 };
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

/**
 * Pre-fill ordinals for repeated verses if none were spoken. Only APPLIED
 * markers advance the count — an unconfirmed low-confidence candidate must
 * not shift the numbering of the sections that actually split the take.
 */
function backfillVerseOrdinals(markers: SectionMarker[]): SectionMarker[] {
  let verseCount = 0;
  return markers.map((m) => {
    if (m.kind !== "verse" || !isAppliedMarker(m)) return m;
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
  const canonical = canonicalizeTokens(tokens);
  const found: SectionMarker[] = [];

  let i = 0;
  while (i < tokens.length) {
    let matched: { rule: KeywordRule; len: number } | null = null;
    for (const rule of RULES) {
      const slice = canonical.slice(i, i + rule.tokens.length).join(" ");
      if (slice === rule.tokens.join(" ")) {
        // A repeat call ("second time") only means something after a section
        // has already been announced — cold, it's just lyric words.
        if (rule.repeatPrevious && found.length === 0) continue;
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
    let kind = matched.rule.kind;
    if (matched.rule.repeatPrevious) {
      // "second time" → repeat the previous section as its second pass.
      kind = found[found.length - 1].kind;
      ordinal = 2;
    } else if (matched.rule.fixedOrdinal != null) {
      // "first verse" → ordinal baked in; nothing more to absorb.
      ordinal = matched.rule.fixedOrdinal;
    } else if (matched.rule.takesOrdinal !== false) {
      // Every other section can be numbered + lettered by voice.
      const ov = consumeOrdinalVariant(tokens, i + matched.len);
      ordinal = ov.ordinal;
      variant = ov.variant;
      consumed += ov.consumed;
    }

    // Walk backwards over leading-filler tokens so the marker absorbs them —
    // but only while the words run CONTINUOUSLY into the phrase. Across a real
    // pause the same word is the lyric's tail, not part of the announcement.
    let phraseStart = i;
    while (
      phraseStart > 0 &&
      LEADING_FILLERS.has(tokens[phraseStart - 1]) &&
      words[phraseStart].startMs - words[phraseStart - 1].endMs < FILLER_MAX_GAP_MS &&
      // Don't consume tokens that already belong to an earlier marker's body.
      (found.length === 0 || words[phraseStart - 1].startMs > (found[found.length - 1].contentStartMs ?? found[found.length - 1].atMs))
    ) {
      phraseStart -= 1;
    }

    const phraseStartWord = words[phraseStart] ?? startWord;
    const lastConsumedIdx = i + consumed - 1;
    const lastConsumedWord = words[lastConsumedIdx] ?? startWord;

    // ---- Command-vs-content confidence (the Dragon lesson) ----------------
    // An announcement arrives after a breath and often pauses again before the
    // content; a section word sung as a lyric runs mid-phrase with no pause.
    const prevWord = words[phraseStart - 1];
    let confidence: number;
    if (!prevWord) {
      confidence = 0.95; // very start of the take = announcement
    } else {
      const gapBefore = phraseStartWord.startMs - prevWord.endMs;
      if (gapBefore >= CLEAR_PAUSE_MS) confidence = 0.9;
      else if (gapBefore >= SOFT_PAUSE_MS) confidence = 0.72;
      else confidence = 0.35;
      if (gapBefore < CLEAR_PAUSE_MS && CONTENT_PRECEDERS.has(tokens[phraseStart - 1])) {
        confidence -= 0.2; // "every verse…", "in the chorus…"
      }
    }
    const spokeOrdinal = ordinal != null && !matched.rule.repeatPrevious;
    if (spokeOrdinal) confidence += 0.2; // "verse two" is rarely a lyric
    if (phraseStart < i) confidence += 0.08; // "okay, this is the…" framing
    const nextWord = words[i + consumed];
    if (!nextWord) {
      confidence += 0.12; // trailing announcement at the very end of the take
    } else {
      const gapAfter = nextWord.startMs - lastConsumedWord.endMs;
      if (gapAfter < CLEAR_PAUSE_MS && canonical[i + consumed] === "of") {
        confidence -= 0.2; // "…chorus of heaven", "…verse of this psalm"
      } else if (gapAfter >= SOFT_PAUSE_MS) {
        confidence += 0.12; // breath after announcing
      }
    }
    confidence = Math.min(0.99, Math.max(0.05, confidence));

    found.push({
      atMs: phraseStartWord.startMs,
      contentStartMs: lastConsumedWord.endMs,
      kind,
      ordinal,
      variant,
      source: "voice",
      confidence,
      label: matched.rule.labelOverride ?? defaultLabel(kind, ordinal, variant),
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

/**
 * Split a word stream into transcript blocks using the detected markers.
 * Low-confidence voice markers are EXCLUDED here — a doubtful "verse" spoken
 * inside a lyric never silently restructures the take; it rides along as a
 * candidate for one-tap confirmation in review instead.
 */
export function buildTranscriptBlocks(
  words: TranscriptWord[],
  markers: SectionMarker[],
): TranscriptBlock[] {
  const sorted = markers.filter(isAppliedMarker).sort((a, b) => a.atMs - b.atMs);
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