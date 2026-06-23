/**
 * Lyric & Chord Sheet model — the syllable-bonded layer on top of the Nashville
 * engine. A chord is bonded to a character index inside a lyric line and stored
 * key-independently (as a NumberChord), so:
 *   • the chord stays on its syllable when the lyric is edited, and
 *   • one-tap transpose is free — only the render key changes, never the data.
 *
 * It also round-trips ChordPro (`[C]lyric`) losslessly at the line level, which
 * is the whole reason ChordPro's inline model beats fragile monospace columns:
 * alignment survives editing.
 *
 * Pure functions only. No React, no I/O. Reuses ./nashville + ./keys for all
 * chord math — this file never re-implements music theory.
 */

import {
  type NumberChord,
  type Degree,
  type ChordQuality,
  type ChordExtension,
  chordToLetters,
  chordToNumbers,
} from "./nashville";
import {
  type Mode,
  type Accidental,
  SCALE,
  pitchClass,
} from "./keys";

// ─── Types ──────────────────────────────────────────────────────────────────

/** A chord bonded to a character index within a lyric line. */
export interface ChordAnchor {
  chord: NumberChord;
  /** UTF-16 index in the line's `text` the chord sits over (0..text.length). */
  at: number;
}

/** One lyric line plus the chords bonded to its syllables. */
export interface SheetLine {
  text: string;
  /** Always normalized: sorted ascending by `at`, clamped to the line. */
  anchors: ChordAnchor[];
  /** Index of the raw line in the source document (set by parseChordPro), so a
   *  UI can edit exactly that source line without re-serializing the whole doc. */
  sourceLineIndex?: number;
}

/** A labelled section (Verse 1, Chorus…) — the song's skeleton. */
export interface SheetSection {
  label?: string;
  lines: SheetLine[];
}

type Display = "letters" | "numbers";

// ─── Chord token parsing (letters → key-independent NumberChord) ─────────────

const ROOT_RE = /^([A-G])([#b]?)(.*)$/;

/** Inverse of degreePC: which scale degree (+ accidental) is this pitch class? */
function pcToDegree(
  pc: number,
  tonic: string,
  mode: Mode,
): { degree: Degree; accidental?: Accidental } {
  const tonicPC = pitchClass(tonic.replace(/m$/, ""));
  const scale = SCALE[mode];
  // Exact diatonic match wins.
  for (let i = 0; i < 7; i++) {
    if (((tonicPC + scale[i]) % 12 + 12) % 12 === pc) {
      return { degree: (i + 1) as Degree };
    }
  }
  // Otherwise spell as a flat of the degree above (b3, b7…) — the common
  // worship/Nashville convention for borrowed chords.
  for (let i = 0; i < 7; i++) {
    if (((tonicPC + scale[i] - 1) % 12 + 12) % 12 === pc) {
      return { degree: (i + 1) as Degree, accidental: "b" };
    }
  }
  // Last resort: sharp of the degree below.
  for (let i = 0; i < 7; i++) {
    if (((tonicPC + scale[i] + 1) % 12 + 12) % 12 === pc) {
      return { degree: (i + 1) as Degree, accidental: "#" };
    }
  }
  return { degree: 1 };
}

/** Parse a chord suffix (everything after the root) into quality + extension. */
function parseSuffix(
  suffix: string,
): { quality: ChordQuality; extension?: ChordExtension } | null {
  let s = suffix.trim();

  // Quality — order matters: maj7 before m, sus4 before sus2 handled explicitly.
  let quality: ChordQuality = "maj";
  if (s.startsWith("maj")) {
    quality = "maj"; // 'maj7' handled in extension pass
  } else if (s === "°" || s.startsWith("dim")) {
    quality = "dim";
    s = s.replace(/^(°|dim)/, "");
  } else if (s === "+" || s.startsWith("aug")) {
    quality = "aug";
    s = s.replace(/^(\+|aug)/, "");
  } else if (s.startsWith("sus2")) {
    quality = "sus2";
    s = s.slice(4);
  } else if (s.startsWith("sus4") || s === "sus") {
    quality = "sus4";
    s = s.replace(/^sus4?/, "");
  } else if (s.startsWith("m") && !s.startsWith("maj")) {
    quality = "min";
    s = s.slice(1);
  }

  // Extension — what remains.
  let extension: ChordExtension | undefined;
  if (s === "maj7") {
    extension = "maj7";
    s = "";
  } else if (s === "add9") {
    extension = "add9";
    s = "";
  } else if (s === "7" || s === "9" || s === "13") {
    extension = s as ChordExtension;
    s = "";
  } else if (s === "") {
    extension = undefined;
  } else {
    return null; // unrecognized remainder
  }

  return { quality, extension };
}

/**
 * Parse a letter chord ("C", "Am", "G7", "F#m", "D/F#", "Bdim") into a
 * key-independent NumberChord, relative to the given key. Returns null on junk.
 */
export function parseChordToken(
  token: string,
  tonic: string,
  mode: Mode = "major",
): NumberChord | null {
  const raw = token.trim();
  if (!raw) return null;

  // Bass / slash split.
  const [main, bassRaw] = raw.split("/");
  const m = main.match(ROOT_RE);
  if (!m) return null;

  const rootLetter = m[1] + (m[2] ?? "");
  const rootPC = pitchClass(rootLetter);
  if (rootPC < 0) return null;

  const parsed = parseSuffix(m[3] ?? "");
  if (!parsed) return null;

  const { degree, accidental } = pcToDegree(rootPC, tonic, mode);
  const chord: NumberChord = { degree, quality: parsed.quality };
  if (accidental) chord.accidental = accidental;
  if (parsed.extension) chord.extension = parsed.extension;

  if (bassRaw) {
    const bassPC = pitchClass(bassRaw.trim());
    if (bassPC >= 0) {
      const b = pcToDegree(bassPC, tonic, mode);
      chord.bass = b.accidental ? { degree: b.degree, accidental: b.accidental } : { degree: b.degree };
    }
  }

  return chord;
}

// ─── Anchor normalization ────────────────────────────────────────────────────

function normalize(text: string, anchors: ChordAnchor[]): SheetLine {
  const clamped = anchors
    .map((a) => ({ chord: a.chord, at: Math.max(0, Math.min(text.length, a.at)) }))
    .sort((a, b) => a.at - b.at);
  return { text, anchors: clamped };
}

// ─── ChordPro line round-trip ────────────────────────────────────────────────

const INLINE_CHORD_RE = /\[([^\]]+)\]/g;

/** Parse one ChordPro line ("[C]Hello [G]world") into a bonded SheetLine. */
export function parseChordProLine(
  raw: string,
  tonic: string,
  mode: Mode = "major",
): SheetLine {
  const anchors: ChordAnchor[] = [];
  let text = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  INLINE_CHORD_RE.lastIndex = 0;
  while ((match = INLINE_CHORD_RE.exec(raw)) !== null) {
    text += raw.slice(lastIndex, match.index);
    const chord = parseChordToken(match[1], tonic, mode);
    if (chord) anchors.push({ chord, at: text.length });
    lastIndex = match.index + match[0].length;
  }
  text += raw.slice(lastIndex);

  return normalize(text, anchors);
}

/** Serialize a SheetLine back to a ChordPro line in the given key. */
export function lineToChordPro(
  line: SheetLine,
  tonic: string,
  mode: Mode = "major",
): string {
  const anchors = [...line.anchors].sort((a, b) => a.at - b.at);
  let out = "";
  let cursor = 0;
  for (const a of anchors) {
    const at = Math.max(0, Math.min(line.text.length, a.at));
    out += line.text.slice(cursor, at);
    out += `[${chordToLetters(a.chord, tonic, mode)}]`;
    cursor = at;
  }
  out += line.text.slice(cursor);
  return out;
}

// ─── Chords-over-lyrics render (the classic two-row view) ────────────────────

/**
 * Render a line as two aligned rows — a chord row above and the lyric row —
 * the way every tab site and worship chart shows it. Chords that would collide
 * are pushed right with a one-space gap so nothing overlaps.
 */
export function renderChordsOverLyrics(
  line: SheetLine,
  tonic: string,
  mode: Mode = "major",
  display: Display = "letters",
): { chords: string; lyrics: string } {
  let chords = "";
  for (const a of line.anchors) {
    const glyph =
      display === "letters" ? chordToLetters(a.chord, tonic, mode) : chordToNumbers(a.chord, mode);
    const col = chords.length === 0 ? a.at : Math.max(a.at, chords.length + 1);
    chords = chords.padEnd(col, " ") + glyph;
  }
  return { chords, lyrics: line.text };
}

// ─── Edit-safe anchor shifting ───────────────────────────────────────────────

/**
 * Recompute anchor positions after a text edit that replaces
 * [start, start+deleteCount) with `insertCount` new characters.
 *   • anchors before the edit stay put,
 *   • anchors at/after the edit shift by the net delta (so a chord follows its
 *     syllable when text is inserted ahead of it),
 *   • an anchor sitting inside a deleted span clamps to the edit point — it is
 *     never orphaned or silently dropped.
 *
 * NOTE: this returns shifted anchors against the SAME `text`; the caller owns
 * applying the actual string edit and passing the new text via `newText`.
 */
export function shiftAnchorsForEdit(
  line: SheetLine,
  start: number,
  deleteCount: number,
  insertCount: number,
  newText?: string,
): SheetLine {
  const end = start + deleteCount;
  const delta = insertCount - deleteCount;
  const text =
    newText ??
    line.text.slice(0, start) + " ".repeat(Math.max(0, insertCount)) + line.text.slice(end);

  const moved = line.anchors.map((a) => {
    if (a.at < start) return { ...a };
    if (a.at >= end) return { ...a, at: a.at + delta };
    return { ...a, at: start }; // inside the deleted span — clamp, never orphan
  });

  return normalize(text, moved);
}

// ─── One-tap transpose (key letter) ──────────────────────────────────────────

const MAJOR_PC_TO_TONIC = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_PC_TO_TONIC = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

/**
 * Move a key letter by N semitones, with sensible spelling for the mode.
 * Anchors never change on transpose — only the key you render in does — so this
 * is just for the key picker / +-semitone buttons.
 */
export function transposeKeyLetter(tonic: string, mode: Mode, semitones: number): string {
  const base = pitchClass(tonic.replace(/m$/, ""));
  if (base < 0) return tonic;
  const pc = ((base + semitones) % 12 + 12) % 12;
  return (mode === "minor" ? MINOR_PC_TO_TONIC : MAJOR_PC_TO_TONIC)[pc];
}

// ─── ChordPro section parsing ────────────────────────────────────────────────

const DIRECTIVE_RE = /^\{([a-z_]+)(?::\s*(.*))?\}$/i;

const SECTION_LABELS: Record<string, string> = {
  start_of_verse: "Verse",
  sov: "Verse",
  start_of_chorus: "Chorus",
  soc: "Chorus",
  start_of_bridge: "Bridge",
  sob: "Bridge",
};

/**
 * Parse a multi-line ChordPro document into labelled sections. Recognizes
 * start_of_… and end_of_… (and short forms) plus comment/c for labels; other
 * directives (title, key…) are ignored at this layer.
 */
export function parseChordPro(
  source: string,
  tonic: string,
  mode: Mode = "major",
): SheetSection[] {
  const sections: SheetSection[] = [];
  let current: SheetSection | null = null;

  const ensure = (): SheetSection => {
    if (!current) {
      current = { lines: [] };
      sections.push(current);
    }
    return current;
  };

  const rawLines = source.split("\n");
  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();
    if (trimmed === "") continue;

    const dir = trimmed.match(DIRECTIVE_RE);
    if (dir) {
      const name = dir[1].toLowerCase();
      const value = dir[2]?.trim();
      if (name.startsWith("end_of_") || name === "eov" || name === "eoc" || name === "eob") {
        current = null;
        continue;
      }
      if (name in SECTION_LABELS || name.startsWith("start_of_")) {
        current = { label: value || SECTION_LABELS[name], lines: [] };
        sections.push(current);
        continue;
      }
      if (name === "comment" || name === "c") {
        ensure().label = value;
        continue;
      }
      continue; // ignore other directives at this layer
    }

    ensure().lines.push({ ...parseChordProLine(rawLine, tonic, mode), sourceLineIndex: i });
  }

  return sections;
}

/** Serialize sections back to ChordPro (structure-preserving). */
export function toChordPro(
  sections: SheetSection[],
  tonic: string,
  mode: Mode = "major",
): string {
  const out: string[] = [];
  for (const s of sections) {
    if (s.label) out.push(`{comment: ${s.label}}`);
    for (const line of s.lines) out.push(lineToChordPro(line, tonic, mode));
    out.push("");
  }
  return out.join("\n").trimEnd();
}
