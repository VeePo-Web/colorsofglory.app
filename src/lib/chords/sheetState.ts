/**
 * Sheet state engine — pure, immutable operations over a song's structured
 * lyric & chord sheet (sections → lines → syllable-bonded chord anchors).
 *
 * Every mutating op returns `{ doc, event }`:
 *   • `doc`   — a NEW document (inputs are never mutated), and
 *   • `event` — a typed draft matching docs/contracts/lyric-sheet-events.md, or
 *               null when the target wasn't found (safe no-op).
 *
 * The UI/host layer wraps each draft in the full SheetEvent envelope (id,
 * actorId, at) and forwards it to the Collaboration lane. This engine NEVER
 * writes the feed / version history / credits itself — it only emits.
 *
 * Pure functions only. No React, no I/O. Chords are stored key-independently
 * (NumberChord) so transpose is free; events render chords to letters in the
 * current key so Collaboration stores human-readable values.
 */

import {
  type NumberChord,
  chordToLetters,
} from "./nashville";
import { type Mode } from "./keys";
import {
  type SheetLine,
  type SheetSection,
  type ChordAnchor,
  shiftAnchorsForEdit,
  parseChordPro,
  lineToChordPro,
} from "./sheet";

// ─── Document shape ──────────────────────────────────────────────────────────

export interface SheetLineDoc extends SheetLine {
  id: string;
}

export interface SheetSectionDoc {
  id: string;
  label: string;
  lines: SheetLineDoc[];
  /** If this section repeats another (e.g. Chorus 2), the source section id. */
  repeatOf?: string;
}

export interface SheetDoc {
  songId: string;
  key: string; // the display key (tonic); transpose changes this only
  mode: Mode;
  originalKey: string;
  capo: number;
  bpm?: number;
  display: "letters" | "numbers";
  sections: SheetSectionDoc[];
}

// ─── Event drafts (envelope added by the host) ───────────────────────────────

type RenderedAnchor = { chord: string; at: number };

export type SheetEventDraft =
  | { type: "section_added"; entity: Entity; payload: { sectionId: string; label: string; position: number } }
  | { type: "section_renamed"; entity: Entity; payload: { sectionId: string; from: string; to: string } }
  | { type: "section_reordered"; entity: Entity; payload: { sectionId: string; from: number; to: number } }
  | { type: "section_removed"; entity: Entity; payload: { sectionId: string; label: string } }
  | { type: "lyric_edited"; entity: Entity; payload: { sectionId: string; lineId: string; lineIndex: number; before: string; after: string } }
  | { type: "chords_changed"; entity: Entity; payload: { sectionId: string; lineId: string; anchors: RenderedAnchor[]; before: RenderedAnchor[] } }
  | { type: "key_changed"; entity: Entity; payload: { fromKey: string; toKey: string; capo?: number; display?: "letters" | "numbers"; nonDestructive: true } };

interface Entity {
  type: "section" | "line" | "chord" | "song";
  id: string;
  sectionLabel?: string;
}

type Result = { doc: SheetDoc; event: SheetEventDraft | null };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const noop = (doc: SheetDoc): Result => ({ doc, event: null });

function findSection(doc: SheetDoc, sectionId: string): { section: SheetSectionDoc; index: number } | null {
  const index = doc.sections.findIndex((s) => s.id === sectionId);
  return index < 0 ? null : { section: doc.sections[index], index };
}

function renderAnchors(line: SheetLine, doc: SheetDoc): RenderedAnchor[] {
  return line.anchors.map((a) => ({ chord: chordToLetters(a.chord, doc.key, doc.mode), at: a.at }));
}

/** Replace a section by id, returning a new doc. */
function withSection(doc: SheetDoc, sectionId: string, fn: (s: SheetSectionDoc) => SheetSectionDoc): SheetDoc {
  return { ...doc, sections: doc.sections.map((s) => (s.id === sectionId ? fn(s) : s)) };
}

/** Replace a line within a section, returning a new doc. */
function withLine(
  doc: SheetDoc,
  sectionId: string,
  lineId: string,
  fn: (l: SheetLineDoc) => SheetLineDoc,
): SheetDoc {
  return withSection(doc, sectionId, (s) => ({
    ...s,
    lines: s.lines.map((l) => (l.id === lineId ? fn(l) : l)),
  }));
}

// ─── Document creation ───────────────────────────────────────────────────────

export function createDoc(params: {
  songId: string;
  key: string;
  mode?: Mode;
  bpm?: number;
  display?: "letters" | "numbers";
}): SheetDoc {
  return {
    songId: params.songId,
    key: params.key,
    mode: params.mode ?? "major",
    originalKey: params.key,
    capo: 0,
    bpm: params.bpm,
    display: params.display ?? "letters",
    sections: [],
  };
}

// ─── Ids + ChordPro ↔ doc bridges ────────────────────────────────────────────

/** Stable id for sections/lines. UUID when available; time-random fallback. */
export function newSheetId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `sh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Wrap parsed ChordPro sections in a SheetDoc, minting fresh ids. */
export function docFromSections(
  params: { songId: string; key: string; mode?: Mode; bpm?: number; display?: "letters" | "numbers" },
  sections: SheetSection[],
): SheetDoc {
  const doc = createDoc(params);
  return {
    ...doc,
    sections: sections.map((s) => ({
      id: newSheetId(),
      label: s.label ?? "",
      lines: s.lines.map((l) => ({ id: newSheetId(), text: l.text, anchors: l.anchors })),
    })),
  };
}

/**
 * Parse a raw ChordPro document into a SheetDoc. Line/section ids are freshly
 * minted — an import replaces line identity, which is why the textarea is an
 * import affordance, not the primary editing path.
 */
export function docFromChordPro(
  params: { songId: string; key: string; mode?: Mode; bpm?: number; display?: "letters" | "numbers" },
  source: string,
): SheetDoc {
  return docFromSections(params, parseChordPro(source, params.key, params.mode ?? "major"));
}

/** View a SheetDoc as plain sections (for renderers built on SheetSection). */
export function docToSections(doc: SheetDoc): SheetSection[] {
  return doc.sections.map((s) => ({ label: s.label || undefined, lines: s.lines }));
}

/**
 * Serialize the doc to ChordPro in the given render key (defaults to doc.key).
 * Uses explicit {start_of_verse}/{end_of_verse} directives (not {comment}) so
 * parseChordPro round-trips section BOUNDARIES losslessly — a bare comment
 * after a previous section would merge into it instead of starting a new one.
 */
export function docToChordPro(doc: SheetDoc, tonic?: string, mode?: Mode): string {
  const t = tonic ?? doc.key;
  const m = mode ?? doc.mode;
  const out: string[] = [];
  for (const s of doc.sections) {
    if (s.label) out.push(`{start_of_verse: ${s.label}}`);
    else out.push("{end_of_verse}"); // break any open section; lines below start an unlabeled one
    for (const line of s.lines) out.push(lineToChordPro(line, t, m));
    out.push("");
  }
  return out.join("\n").trimEnd();
}

// ─── Section ops ─────────────────────────────────────────────────────────────

export function addSection(
  doc: SheetDoc,
  params: { id: string; label: string; position?: number },
): Result {
  const section: SheetSectionDoc = { id: params.id, label: params.label, lines: [] };
  const position = params.position ?? doc.sections.length;
  const sections = [...doc.sections];
  sections.splice(position, 0, section);
  return {
    doc: { ...doc, sections },
    event: {
      type: "section_added",
      entity: { type: "section", id: params.id, sectionLabel: params.label },
      payload: { sectionId: params.id, label: params.label, position },
    },
  };
}

export function renameSection(doc: SheetDoc, sectionId: string, to: string): Result {
  const found = findSection(doc, sectionId);
  if (!found) return noop(doc);
  const from = found.section.label;
  return {
    doc: withSection(doc, sectionId, (s) => ({ ...s, label: to })),
    event: {
      type: "section_renamed",
      entity: { type: "section", id: sectionId, sectionLabel: to },
      payload: { sectionId, from, to },
    },
  };
}

export function reorderSection(doc: SheetDoc, sectionId: string, toIndex: number): Result {
  const found = findSection(doc, sectionId);
  if (!found) return noop(doc);
  const from = found.index;
  const to = Math.max(0, Math.min(doc.sections.length - 1, toIndex));
  if (from === to) return noop(doc);
  const sections = [...doc.sections];
  const [moved] = sections.splice(from, 1);
  sections.splice(to, 0, moved);
  return {
    doc: { ...doc, sections },
    event: {
      type: "section_reordered",
      entity: { type: "section", id: sectionId, sectionLabel: found.section.label },
      payload: { sectionId, from, to },
    },
  };
}

export function removeSection(doc: SheetDoc, sectionId: string): Result {
  const found = findSection(doc, sectionId);
  if (!found) return noop(doc);
  return {
    doc: { ...doc, sections: doc.sections.filter((s) => s.id !== sectionId) },
    event: {
      type: "section_removed",
      entity: { type: "section", id: sectionId, sectionLabel: found.section.label },
      payload: { sectionId, label: found.section.label },
    },
  };
}

// ─── Line ops ────────────────────────────────────────────────────────────────

/** Add a line. Structural only — an empty line emits no event. */
export function addLine(doc: SheetDoc, sectionId: string, params: { id: string; text?: string }): Result {
  const found = findSection(doc, sectionId);
  if (!found) return noop(doc);
  const line: SheetLineDoc = { id: params.id, text: params.text ?? "", anchors: [] };
  return {
    doc: withSection(doc, sectionId, (s) => ({ ...s, lines: [...s.lines, line] })),
    event: null,
  };
}

export function editLineText(
  doc: SheetDoc,
  sectionId: string,
  lineId: string,
  edit: { start: number; deleteCount: number; insertCount: number; newText: string },
): Result {
  const found = findSection(doc, sectionId);
  if (!found) return noop(doc);
  const lineIndex = found.section.lines.findIndex((l) => l.id === lineId);
  if (lineIndex < 0) return noop(doc);
  const before = found.section.lines[lineIndex].text;

  return {
    doc: withLine(doc, sectionId, lineId, (l) => {
      const shifted = shiftAnchorsForEdit(l, edit.start, edit.deleteCount, edit.insertCount, edit.newText);
      return { ...l, text: shifted.text, anchors: shifted.anchors };
    }),
    event: {
      type: "lyric_edited",
      entity: { type: "line", id: lineId, sectionLabel: found.section.label },
      payload: { sectionId, lineId, lineIndex, before, after: edit.newText },
    },
  };
}

// ─── Chord-anchor ops ────────────────────────────────────────────────────────

export function setChordAnchor(
  doc: SheetDoc,
  sectionId: string,
  lineId: string,
  chord: NumberChord,
  at: number,
): Result {
  const found = findSection(doc, sectionId);
  if (!found) return noop(doc);
  const line = found.section.lines.find((l) => l.id === lineId);
  if (!line) return noop(doc);

  const beforeRendered = renderAnchors(line, doc);
  const col = Math.max(0, Math.min(line.text.length, at));
  const kept = line.anchors.filter((a) => a.at !== col);
  const anchors: ChordAnchor[] = [...kept, { chord, at: col }].sort((a, b) => a.at - b.at);

  const newDoc = withLine(doc, sectionId, lineId, (l) => ({ ...l, anchors }));
  const newLine = { ...line, anchors };
  return {
    doc: newDoc,
    event: {
      type: "chords_changed",
      entity: { type: "line", id: lineId, sectionLabel: found.section.label },
      payload: { sectionId, lineId, anchors: renderAnchors(newLine, doc), before: beforeRendered },
    },
  };
}

export function removeChordAnchor(doc: SheetDoc, sectionId: string, lineId: string, at: number): Result {
  const found = findSection(doc, sectionId);
  if (!found) return noop(doc);
  const line = found.section.lines.find((l) => l.id === lineId);
  if (!line) return noop(doc);

  const beforeRendered = renderAnchors(line, doc);
  const anchors = line.anchors.filter((a) => a.at !== at);
  const newDoc = withLine(doc, sectionId, lineId, (l) => ({ ...l, anchors }));
  return {
    doc: newDoc,
    event: {
      type: "chords_changed",
      entity: { type: "line", id: lineId, sectionLabel: found.section.label },
      payload: { sectionId, lineId, anchors: renderAnchors({ ...line, anchors }, doc), before: beforeRendered },
    },
  };
}

// ─── Key / capo (transpose is non-destructive; anchors never move) ───────────

export function setKey(doc: SheetDoc, toKey: string, toMode?: Mode): Result {
  const fromKey = doc.key;
  return {
    doc: { ...doc, key: toKey, mode: toMode ?? doc.mode },
    event: {
      type: "key_changed",
      entity: { type: "song", id: doc.songId },
      payload: { fromKey, toKey, capo: doc.capo, display: doc.display, nonDestructive: true },
    },
  };
}

export function setCapo(doc: SheetDoc, capo: number): Result {
  const next = Math.max(0, Math.min(11, capo));
  return {
    doc: { ...doc, capo: next },
    event: {
      type: "key_changed",
      entity: { type: "song", id: doc.songId },
      payload: { fromKey: doc.key, toKey: doc.key, capo: next, display: doc.display, nonDestructive: true },
    },
  };
}

export function restoreOriginalKey(doc: SheetDoc): Result {
  return setKey(doc, doc.originalKey);
}
