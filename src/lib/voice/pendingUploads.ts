import { audioCache } from "./audioCache";
import { uploadVoiceMemo } from "./voiceApi";

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
  await audioCache.set(id, params.blob);

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
export async function flushPendingUpload(id: string): Promise<string | null> {
  const record = readIndex().find((r) => r.id === id);
  if (!record) return null;

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
      // id is the idempotency key: a retry that already reached the server
      // resolves to the same memo instead of duplicating it.
      idempotencyKey: id,
    });
  } catch (err) {
    // The take stays safe and waiting — this is exactly what the calm retry
    // affordance promises the songwriter.
    updateRecord(id, { status: "failed" });
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

/** Permanently discard a queued take — removes the index row and the cached blob. */
export async function discardPendingUpload(id: string): Promise<void> {
  writeIndex(readIndex().filter((r) => r.id !== id));
  await audioCache.delete(id);
}
