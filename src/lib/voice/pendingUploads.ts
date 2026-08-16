import { audioCache } from "./audioCache";
import { uploadVoiceMemo } from "./voiceApi";
import { getAlignmentOffsetMs } from "@/lib/audio/alignmentStore";

/**
 * @deprecated LEGACY save path — superseded by the Capture Outbox.
 * Every C4 voice surface now saves through `saveMemoDurable` (saveMemo.ts) →
 * `captureOutbox`, which adds auto-retry on reconnect/heartbeat/reload and
 * serializable uploader pipelines. The ONLY remaining consumer is the canvas
 * "record over this" orchestration in `SongCanvasExperience` (D3's lane).
 * D3: migrate that save to `saveMemoDurable({ parentMemoId, ... })`, then
 * DELETE this module and its test. Do not add new callers.
 */

/**
 * A take that has been captured inside a song and is on its way to the server.
 * The blob lives in IndexedDB (audioCache) under `id`; this row is the index
 * entry that lets us find it again after a failed upload, a backgrounded tab,
 * or a full app reload. `id` doubles as the upload idempotency key so a retry
 * that already reached the server never creates a duplicate memo.
 */
export interface PendingUpload {
  id: string;
  songId: string;
  title: string;
  durationMs: number;
  mimeType: string;
  sectionLabel: string;
  transcribe: boolean;
  parentMemoId?: string;
  status: "pending" | "uploading" | "failed";
  attempts: number;
  createdAt: string;
  /** The server refused this take PERMANENTLY (not a member, song deleted,
   *  invalid input) — the blob stays safe on-device but the recovery sweeps
   *  stop hammering a wall that will never move. Offline/quota/5xx never park. */
  parked?: boolean;
}

const INDEX_KEY = "cog-pending-uploads";

function readIndex(): PendingUpload[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PendingUpload[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(records: PendingUpload[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(records));
  } catch {
    // non-fatal — the blob in audioCache is the source of truth, this is a finder
  }
}

function updateRecord(id: string, patch: Partial<PendingUpload>): void {
  writeIndex(readIndex().map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface EnqueuePendingUploadParams {
  blob: Blob;
  songId: string;
  mimeType: string;
  durationMs: number;
  title: string;
  sectionLabel: string;
  transcribe?: boolean;
  parentMemoId?: string;
}

/**
 * Queue an in-song take for upload — local-first. The blob is written to the
 * device cache BEFORE the index row and BEFORE any network call, so from the
 * moment this resolves the idea cannot be lost: not by a dropped connection, not
 * by a backgrounded tab, not by the app being killed a second later. This is the
 * same sacred promise the global Seed Ideas shelf already keeps, now extended to
 * memos recorded inside a song.
 */
export async function enqueuePendingUpload(
  params: EnqueuePendingUploadParams,
): Promise<PendingUpload> {
  const id = generateId();

  // Blob to durable storage first — everything else is recoverable from it.
  // The write must be CONFIRMED: iOS Safari private mode / storage pressure
  // can fail the put, and a swallowed failure here meant "Saved" over a take
  // that no longer existed anywhere. Throwing lets the caller keep its own
  // fallback copy alive and tell the songwriter the truth.
  const persisted = await audioCache.setDurable(id, params.blob);
  if (!persisted) {
    throw new Error("take-not-persisted");
  }

  const record: PendingUpload = {
    id,
    songId: params.songId,
    title: params.title,
    durationMs: params.durationMs,
    mimeType: params.mimeType || params.blob.type || "audio/webm",
    sectionLabel: params.sectionLabel,
    transcribe: params.transcribe ?? false,
    parentMemoId: params.parentMemoId,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  writeIndex([record, ...readIndex()]);
  return record;
}

/**
 * Attempt (or retry) the upload of a queued take through the real voice-memo
 * pipeline. On success the row is removed and the cached blob is re-keyed to the
 * real memo id so first playback is instant. On failure the row is marked
 * "failed", the blob is KEPT (never discarded), and the error is rethrown so the
 * caller can show a calm "your recording is safe — retry" affordance instead of a
 * dead end. Returns the memo id on success, or null if the take is already gone
 * (e.g. the cache was cleared) — in which case the orphan row is swept.
 */
// One flush per row at a time, session-wide: the mount sweep, the `online`
// sweep, and the save path can all reach for the same id — an unguarded race
// double-uploaded the take. In-memory on purpose: a reload clears it, so a
// row stuck "uploading" by a crash still retries next session.
const inFlight = new Set<string>();

export async function flushPendingUpload(id: string): Promise<string | null> {
  if (inFlight.has(id)) return null;
  const record = readIndex().find((r) => r.id === id);
  if (!record) return null;
  // Parked = permanently refused by the server. The blob stays retained on
  // this device; automatic sweeps must not replay it forever.
  if (record.parked) return null;
  inFlight.add(id);
  try {
    return await flushPendingUploadInner(id, record);
  } finally {
    inFlight.delete(id);
  }
}

async function flushPendingUploadInner(id: string, record: PendingUpload): Promise<string | null> {

  // A layer recorded while its BASE was still uploading carries the base's
  // TEMP id as parentMemoId. Sending that to the server writes a garbage
  // parent and the stack relationship is lost forever. Hold the layer back:
  // when the base flushes, remapPendingParents() heals this row to the real
  // memo id and the caller re-flushes it. The blob stays safe throughout.
  if (record.parentMemoId && readIndex().some((r) => r.id === record.parentMemoId)) {
    updateRecord(id, { status: "failed" });
    throw new Error("parent-take-still-uploading");
  }

  const blob = await audioCache.get(id);
  if (!blob) {
    // The blob is gone (cache evicted / already claimed) — drop the orphan row
    // so it stops haunting the list. Nothing to upload.
    writeIndex(readIndex().filter((r) => r.id !== id));
    return null;
  }

  updateRecord(id, { status: "uploading", attempts: record.attempts + 1 });

  let memoId: string;
  try {
    memoId = await uploadVoiceMemo({
      songId: record.songId,
      blob,
      mimeType: record.mimeType || blob.type || "audio/webm",
      durationMs: record.durationMs,
      title: record.title,
      sectionLabel: record.sectionLabel,
      transcribe: record.transcribe,
      parentMemoId: record.parentMemoId,
      // The measured guide-alignment offset (keyed by this pending id until
      // the flush rekeys it) finally reaches the server's layer_offset_ms —
      // without it, cross-device stacks always played misaligned at 0.
      layerOffsetMs: record.parentMemoId
        ? Math.max(0, Math.round(getAlignmentOffsetMs(id))) || undefined
        : undefined,
      // id is the idempotency key: a retry that already reached the server
      // resolves to the same memo instead of duplicating it.
      idempotencyKey: id,
    });
  } catch (err) {
    // The take stays safe and waiting — this is exactly what the calm retry
    // affordance promises the songwriter. A PERMANENT server rejection
    // (stable CogError codes only — never offline, never quota, never 5xx)
    // additionally parks the row: the blob is kept, but the mount/online
    // sweeps stop replaying a request the server will refuse forever.
    const code = (err as { code?: unknown } | null)?.code;
    const permanent =
      typeof code === "string" &&
      ["INVALID_INPUT", "FORBIDDEN", "NOT_A_MEMBER", "SONG_NOT_FOUND", "SONG_DELETED", "METHOD_NOT_ALLOWED"].includes(code);
    updateRecord(id, { status: "failed", ...(permanent ? { parked: true } : {}) });
    if (permanent) {
      throw Object.assign(new Error("take-rejected-permanently"), { cause: err });
    }
    throw err;
  }

  // Re-key the cached blob to the real memo id so the first play is instant,
  // then retire the temp row + temp key.
  await audioCache.set(memoId, blob);
  writeIndex(readIndex().filter((r) => r.id !== id));
  await audioCache.delete(id);
  return memoId;
}

/** Queued/failed takes for a song, newest first — what a recovery sweep replays. */
export async function listPendingUploads(songId: string): Promise<PendingUpload[]> {
  return readIndex()
    .filter((r) => r.songId === songId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * A base take's temp id just became its real memo id — heal every queued
 * layer that still points at the temp parent, and return the healed row ids
 * so the caller can re-flush them immediately (they were held back by the
 * parent-still-uploading guard above).
 */
export function remapPendingParents(oldParentId: string, newParentId: string): string[] {
  const healed: string[] = [];
  writeIndex(
    readIndex().map((r) => {
      if (r.parentMemoId !== oldParentId) return r;
      healed.push(r.id);
      return { ...r, parentMemoId: newParentId, status: "pending" as const };
    }),
  );
  return healed;
}

/** Permanently discard a queued take — removes the index row and the cached blob. */
export async function discardPendingUpload(id: string): Promise<void> {
  writeIndex(readIndex().filter((r) => r.id !== id));
  await audioCache.delete(id);
}
