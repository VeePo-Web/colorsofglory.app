/**
 * detectedTempoKeyStore — per-song metadata about an F13 detection, so the
 * ChordPicker can be HONEST about where a pre-filled value came from.
 *
 * The DB fill (fillSongMusicIfEmpty) is what makes the metronome and the
 * sheet inherit a detected tempo/key with zero extra steps; THIS store is
 * what turns the picker's blank "What key is this song in?" into a calm
 * "Sounds like G major · 94 BPM — tap to confirm, or change it," and marks
 * the values with the gold "detected from your recording" hint until the
 * songwriter confirms or changes them. Confirm/dismiss clears the record —
 * from then on the values are simply theirs.
 *
 * Device-local (localStorage), latest detection wins, capped so it can never
 * grow unbounded. Losing it costs only the hint — never a value.
 */

import type { Mode } from "@/lib/chords/keys";

export interface DetectedTempoKeyRecord {
  /** Suggested BPM (only present when detection cleared the confidence floor). */
  bpm?: number;
  /** Suggested tonic without mode suffix, e.g. "G", "F#". */
  tonic?: string;
  mode?: Mode;
  /** The app-format key signature ("G" / "Em") for quick comparison. */
  keySignature?: string;
  /** Whether detection actually wrote the value into the empty song field. */
  filledBpm: boolean;
  filledKey: boolean;
  /** Epoch ms of the detection (informational). */
  at: number;
}

const STORE_KEY = "cog-detected-tempo-key";
const MAX_ENTRIES = 100;

type StoreShape = Record<string, DetectedTempoKeyRecord>;

function read(): StoreShape {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as StoreShape;
    return {};
  } catch {
    return {};
  }
}

function write(map: StoreShape): void {
  try {
    if (typeof localStorage === "undefined") return;
    const keys = Object.keys(map);
    if (keys.length > MAX_ENTRIES) {
      keys
        .sort((a, b) => (map[a]?.at ?? 0) - (map[b]?.at ?? 0))
        .slice(0, keys.length - MAX_ENTRIES)
        .forEach((k) => delete map[k]);
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {
    /* best-effort — the hint is a nicety, never a dependency */
  }
}

export function writeDetection(songId: string, record: DetectedTempoKeyRecord): void {
  if (!songId) return;
  const map = read();
  map[songId] = record;
  write(map);
}

export function readDetection(songId: string): DetectedTempoKeyRecord | null {
  if (!songId) return null;
  return read()[songId] ?? null;
}

/** The songwriter confirmed or changed the values — the suggestion is spent. */
export function clearDetection(songId: string): void {
  if (!songId) return;
  const map = read();
  if (!(songId in map)) return;
  delete map[songId];
  write(map);
}

/** Test-only. */
export function __clearAllDetectionsForTests(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORE_KEY);
  } catch {
    /* noop */
  }
}
