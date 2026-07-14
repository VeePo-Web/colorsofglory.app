/**
 * alignmentStore — client-held playback alignment offsets for layered takes.
 *
 * A layer recorded while monitoring the base take through headphones is
 * shifted LATE by the device's round-trip latency (guide → ear → voice → mic,
 * typically 100–300ms): the singer performs against what they HEAR, so the
 * recorded layer contains each musical moment later than the base's timeline.
 * Storing that measured offset lets useStackPlayer start the layer that many
 * milliseconds in, so base + layer sit on the same grid instead of drifting
 * permanently (the old "every element starts at time=0" behavior).
 *
 * Persistence is localStorage keyed by memo id, because `voice_memos` has no
 * alignment column yet — the backend ask (voice_memos.alignment_offset_ms,
 * written at finalize) is documented in the metronome handoff doc. When that
 * column lands, this store becomes the offline cache in front of it. Offsets
 * are capped FIFO so the map can never grow unbounded.
 */

const STORE_KEY = "cog-align-offsets";
const MAX_ENTRIES = 200;

type OffsetMap = Record<string, number>;

function read(): OffsetMap {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as OffsetMap;
    }
    return {};
  } catch {
    return {};
  }
}

function write(map: OffsetMap): void {
  try {
    if (typeof localStorage === "undefined") return;
    const keys = Object.keys(map);
    if (keys.length > MAX_ENTRIES) {
      // Insertion order ≈ recording order; drop the oldest overflow.
      for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete map[k];
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {
    /* persistence is best-effort — alignment degrades to 0, never breaks playback */
  }
}

/** Record a measured offset (ms) for a just-recorded layer. 0/negative is dropped. */
export function setAlignmentOffset(memoId: string, offsetMs: number): void {
  const rounded = Math.round(offsetMs);
  if (!memoId || !Number.isFinite(rounded) || rounded <= 0) return;
  const map = read();
  map[memoId] = Math.min(rounded, 2000); // >2s is a measurement error, not latency
  write(map);
}

/** The stored offset for a memo, in ms. 0 when none — the uniform default path. */
export function getAlignmentOffsetMs(memoId: string): number {
  const v = read()[memoId];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * A queued canvas take saves under a temp id and reconciles to the real memo
 * id after upload — the offset must follow it.
 */
export function rekeyAlignmentOffset(oldId: string, newId: string): void {
  if (!oldId || !newId || oldId === newId) return;
  const map = read();
  const v = map[oldId];
  if (typeof v !== "number") return;
  delete map[oldId];
  map[newId] = v;
  write(map);
}

/** Test-only. */
export function __clearAlignmentOffsetsForTests(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORE_KEY);
  } catch {
    /* noop */
  }
}
