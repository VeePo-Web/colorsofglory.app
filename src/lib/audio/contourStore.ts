/**
 * contourStore — device-local home for Melody Lens contours (C4).
 *
 * The server columns (`voice_memos.pitch_contour` / `melody_key`) are filed
 * with Lovable (docs/MELODY-LENS-CONTRACT.md §schema); until they land, this
 * store IS the persistence layer: contours computed at capture (and lazily on
 * playback for legacy memos) live here, render from here, and Hum-to-Find
 * searches from here. When the columns arrive, `resolveContour` prefers the
 * server value and this becomes the offline cache — no consumer changes.
 *
 * One localStorage key, one map, LRU-capped: contours are small (a ~96-point
 * rounded array + a short interval list ≈ ~700 bytes), so 300 memos ≈ 200 KB.
 * Every operation is best-effort — a full/blocked storage never throws into
 * the capture or playback paths.
 */

import type { PitchContourResult } from "@/lib/audio/pitchContour";

const STORE_KEY = "cog:melody-contours";
const MAX_ENTRIES = 300;

interface StoredEntry {
  /** pitch_contour */
  c: number[];
  /** melody_key */
  k: number[];
  /** last-touched (LRU eviction) */
  at: number;
}

type StoreShape = Record<string, StoredEntry>;

function readAll(): StoreShape {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as StoreShape) : {};
  } catch {
    return {};
  }
}

function writeAll(store: StoreShape): void {
  try {
    const ids = Object.keys(store);
    if (ids.length > MAX_ENTRIES) {
      ids
        .sort((a, b) => (store[a].at ?? 0) - (store[b].at ?? 0))
        .slice(0, ids.length - MAX_ENTRIES)
        .forEach((id) => delete store[id]);
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage full/blocked — contours are re-computable, never fatal */
  }
}

const valid = (e: StoredEntry | undefined): e is StoredEntry =>
  Boolean(e && Array.isArray(e.c) && Array.isArray(e.k));

/** The contour for a memo/take id, or null if never computed on this device. */
export function readContour(memoId: string): PitchContourResult | null {
  const entry = readAll()[memoId];
  return valid(entry) ? { pitchContour: entry.c, melodyKey: entry.k } : null;
}

export function writeContour(memoId: string, result: PitchContourResult): void {
  const store = readAll();
  store[memoId] = { c: result.pitchContour, k: result.melodyKey, at: Date.now() };
  writeAll(store);
}

/** Outbox success re-keys the blob from the outbox id to the real memo id —
 *  the contour follows the same rename so nothing recomputes. */
export function renameContour(oldId: string, newId: string): void {
  const store = readAll();
  const entry = store[oldId];
  if (!valid(entry)) return;
  delete store[oldId];
  store[newId] = { ...entry, at: Date.now() };
  writeAll(store);
}

/**
 * Server value wins once Lovable's columns land; the local store covers
 * everything captured or backfilled on this device meanwhile.
 */
export function resolveContour(
  memoId: string,
  server?: { pitchContour?: number[] | null; melodyKey?: number[] | null } | null,
): PitchContourResult | null {
  if (server?.pitchContour && server.pitchContour.length > 0) {
    return { pitchContour: server.pitchContour, melodyKey: server.melodyKey ?? [] };
  }
  return readContour(memoId);
}

/** Every locally-known melody fingerprint — Hum-to-Find's index. */
export function listMelodyKeys(): Array<{ memoId: string; melodyKey: number[] }> {
  const store = readAll();
  const out: Array<{ memoId: string; melodyKey: number[] }> = [];
  for (const [memoId, entry] of Object.entries(store)) {
    if (valid(entry) && entry.k.length > 0) out.push({ memoId, melodyKey: entry.k });
  }
  return out;
}
