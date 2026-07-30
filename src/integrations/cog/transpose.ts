/**
 * R42 — "Sing it in her key."
 *
 * A worship song is written in the key the writer's voice found at 11pm. On
 * Sunday a different person sings it. Today the room forces a choice: retype
 * every chord, or sing it in the wrong key. Both are wrong answers.
 *
 * This module is pure arithmetic on chord symbols. Nothing here touches the
 * database on its own: transposition is a VIEW by default (the stored song is
 * untouched), and committing is one explicit call that rewrites the same
 * progressions through the existing guarded chord writes.
 */
import { getChordsBoard, saveChordProgression, setSongMusicalMeta, type ChordSymbol } from "./chords";

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
/** Keys that musicians conventionally spell with flats. */
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"]);

const NOTE_RE = /^([A-Ga-g])([#b♯♭]?)/;

function noteIndex(letter: string, accidental: string): number | null {
  const base = SHARP.indexOf(letter.toUpperCase());
  if (base < 0) return null;
  let i = base;
  if (accidental === "#" || accidental === "♯") i += 1;
  if (accidental === "b" || accidental === "♭") i -= 1;
  return ((i % 12) + 12) % 12;
}

function spell(index: number, preferFlats: boolean): string {
  return (preferFlats ? FLAT : SHARP)[((index % 12) + 12) % 12];
}

/**
 * Transpose one chord symbol by `semitones`. Handles slash bass notes,
 * qualities (m, maj7, sus4, add9, dim, 7), and leaves anything unparseable
 * exactly as written — a chart is never silently mangled.
 */
export function transposeChord(chord: ChordSymbol, semitones: number, preferFlats = false): ChordSymbol {
  if (!chord || !chord.trim()) return chord;
  const parts = chord.split("/");
  const out = parts.map((part, i) => {
    const trimmed = part.trim();
    const m = trimmed.match(NOTE_RE);
    if (!m) return part;
    const idx = noteIndex(m[1], m[2]);
    if (idx === null) return part;
    // Only the first segment carries the quality; the second is a bass note.
    const rest = trimmed.slice(m[0].length);
    const moved = spell(idx + semitones, preferFlats);
    return i === 0 ? moved + rest : moved + rest;
  });
  return out.join("/");
}

/** Transpose a whole progression. */
export function transposeChords(chords: ChordSymbol[], semitones: number, preferFlats = false): ChordSymbol[] {
  return chords.map((c) => transposeChord(c, semitones, preferFlats));
}

/** The key you land in, given the song's current key and a shift. Null-safe. */
export function transposeKey(key: string | null, semitones: number): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  const m = trimmed.match(NOTE_RE);
  if (!m) return key;
  const idx = noteIndex(m[1], m[2]);
  if (idx === null) return key;
  const suffix = trimmed.slice(m[0].length); // "m", " minor", ""
  const target = ((idx + semitones) % 12 + 12) % 12;
  const preferFlats = FLAT_KEYS.has(spell(target, true) + suffix.trim());
  return spell(target, preferFlats) + suffix;
}

/** How many semitones from one key to another (always the shortest way up). */
export function semitonesBetween(fromKey: string | null, toKey: string | null): number {
  if (!fromKey || !toKey) return 0;
  const a = fromKey.trim().match(NOTE_RE);
  const b = toKey.trim().match(NOTE_RE);
  if (!a || !b) return 0;
  const ai = noteIndex(a[1], a[2]);
  const bi = noteIndex(b[1], b[2]);
  if (ai === null || bi === null) return 0;
  return ((bi - ai) % 12 + 12) % 12;
}

/** Should this key be written with flats? Drives the whole chart's spelling. */
export function prefersFlats(key: string | null): boolean {
  if (!key) return false;
  return FLAT_KEYS.has(key.trim());
}

/** The twelve keys, ordered from the song's own key outward. For a key picker. */
export function keyOptions(currentKey: string | null): { key: string; semitones: number }[] {
  const opts: { key: string; semitones: number }[] = [];
  for (let s = -5; s <= 6; s++) {
    const key = transposeKey(currentKey, s);
    if (key) opts.push({ key, semitones: s });
  }
  return opts;
}

/**
 * A guitarist's shortcut: play the shapes you already know, with a capo.
 * Returns null when the shift is better played as written.
 */
export function capoSuggestion(semitones: number): { fret: number; playAsIfIn: string | null } | null {
  const up = ((semitones % 12) + 12) % 12;
  if (up === 0 || up > 7) return null;
  return { fret: up, playAsIfIn: null };
}

/**
 * Make it permanent. Rewrites every progression in the song and updates the
 * song key, through the existing guarded writes (owner/collaborator only,
 * each write logged to the feed). Returns the new key.
 *
 * Only call this when the writer explicitly chooses "Keep this key" —
 * everything else in this module is display-only.
 */
export async function commitTranspose(songId: string, semitones: number): Promise<string | null> {
  if (!semitones) return null;
  const board = await getChordsBoard(songId);
  const newKey = transposeKey(board.song.key_signature, semitones);
  const flats = prefersFlats(newKey);

  for (const progression of board.progressions) {
    await saveChordProgression({
      songId,
      progressionId: progression.id,
      sectionId: progression.section_id,
      label: progression.label,
      chords: transposeChords(progression.chords, semitones, flats),
    });
  }

  await setSongMusicalMeta({ songId, keySignature: newKey });
  return newKey;
}
