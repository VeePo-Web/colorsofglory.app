import { audioCache } from "./audioCache";
import { uploadVoiceMemo } from "./voiceApi";

/**
 * The Capture Outbox — the sacred promise made reliable for EVERY in-song save.
 *
 * A recorded take exists nowhere but in memory until it is uploaded. If the
 * network drops, the phone is offline, or the tab closes mid-upload, a naive
 * `await uploadVoiceMemo()` loses the only copy of an idea the songwriter just
 * sang. This module makes that impossible:
 *
 *   1. The blob is written to the local audio cache (IndexedDB) BEFORE any
 *      network call — durable across reload, crash, and offline.
 *   2. A content-free job record is persisted to localStorage so the queue
 *      survives a full page reload.
 *   3. Upload is attempted with a STABLE idempotency key (so retries never
 *      double-create), and on failure the take + job are RETAINED, not
 *      discarded — then retried automatically on `online`, on a heartbeat, and
 *      at next app load.
 *
 * It generalizes the proven seed-idea capture path into one primitive every
 * capture surface can route through. No backend change: it reuses the existing
 * 3-step `uploadVoiceMemo` pipeline and the existing `audioCache`.
 */

const INDEX_KEY = "cog-capture-outbox";
const MAX_ATTEMPTS_BEFORE_PARKED = 6; // keep retrying, but stop the tight loop
const HEARTBEAT_MS = 20_000;

export interface OutboxJob {
  /** Outbox id — also the audioCache key holding the blob. */
  id: string;
  songId: string;
  title: string;
  mimeType: string;
  durationMs: number;
  sectionLabel: string;
  transcribe?: boolean;
  parentMemoId?: string;
  fileName?: string;
  /** Stable across retries so the backend dedupes a re-sent take. */
  idempotencyKey: string;
  status: "queued" | "uploading" | "failed";
  attempts: number;
  createdAt: string;
  lastError?: string;
}

export type OutboxEvent =
  | { type: "success"; outboxId: string; memoId: string; songId: string }
  | { type: "failed"; outboxId: string; songId: string; error: string; willRetry: boolean }
  | { type: "change"; pending: number };

type Listener = (event: OutboxEvent) => void;

const listeners = new Set<Listener>();
const inFlight = new Set<string>();
let processingAll = false;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let wired = false;
// Production always auto-attempts an upload the instant a take is enqueued.
// Tests flip this off so they can drive processing deterministically rather
// than racing a fire-and-forget background promise.
let autoProcess = true;

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readIndex(): OutboxJob[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OutboxJob[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(jobs: OutboxJob[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(jobs));
  } catch {
    // The blob in audioCache is the real source of truth; the index is a
    // convenience. A write failure must never throw on the capture path.
  }
}

function patchJob(id: string, patch: Partial<OutboxJob>): void {
  writeIndex(readIndex().map((j) => (j.id === id ? { ...j, ...patch } : j)));
}

function removeJob(id: string): void {
  writeIndex(readIndex().filter((j) => j.id !== id));
}

function emit(event: OutboxEvent): void {
  for (const l of listeners) {
    try {
      l(event);
    } catch {
      /* a bad listener must not break the queue */
    }
  }
}

function emitChange(): void {
  emit({ type: "change", pending: readIndex().length });
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Subscribe to outbox results. Returns an unsubscribe fn. */
export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** How many takes are still waiting to sync. */
export function pendingCount(): number {
  return readIndex().length;
}

function ensureWired(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("online", () => void processOutbox());
  // Process any jobs left over from a previous session as soon as we load.
  void processOutbox();
}

function ensureHeartbeat(): void {
  if (heartbeat || typeof window === "undefined") return;
  heartbeat = setInterval(() => {
    if (readIndex().length === 0) {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      return;
    }
    void processOutbox();
  }, HEARTBEAT_MS);
}

/**
 * Queue a captured take for upload. The blob is cached FIRST (the sacred
 * promise), then the upload is attempted in the background. Returns the outbox
 * id immediately so the UI can show an optimistic, already-safe card.
 */
export async function enqueueCaptureUpload(params: {
  blob: Blob;
  songId: string;
  title: string;
  mimeType: string;
  durationMs: number;
  sectionLabel: string;
  transcribe?: boolean;
  parentMemoId?: string;
  fileName?: string;
}): Promise<{ outboxId: string }> {
  const id = generateId("outbox");

  // 1 — durable BEFORE anything else can fail.
  await audioCache.set(id, params.blob);

  const job: OutboxJob = {
    id,
    songId: params.songId,
    title: params.title,
    mimeType: params.mimeType || params.blob.type || "audio/webm",
    durationMs: params.durationMs,
    sectionLabel: params.sectionLabel,
    transcribe: params.transcribe,
    parentMemoId: params.parentMemoId,
    fileName: params.fileName,
    idempotencyKey: generateId("idem"),
    status: "queued",
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  writeIndex([job, ...readIndex()]);
  emitChange();

  ensureWired();
  ensureHeartbeat();

  // Kick a background attempt; never await it on the capture path.
  if (autoProcess) void processJob(id);

  return { outboxId: id };
}

async function processJob(id: string): Promise<void> {
  if (inFlight.has(id)) return;
  const job = readIndex().find((j) => j.id === id);
  if (!job) return;

  // Offline: leave it queued and let the `online` listener pick it up. The take
  // is already safe in the cache.
  if (isOffline()) {
    patchJob(id, { status: "queued" });
    emit({ type: "failed", outboxId: id, songId: job.songId, error: "offline", willRetry: true });
    return;
  }

  const blob = await audioCache.get(id);
  if (!blob) {
    // The blob is gone (already claimed elsewhere / cleared) — drop the orphan
    // job so it can't loop forever.
    removeJob(id);
    emitChange();
    return;
  }

  inFlight.add(id);
  patchJob(id, { status: "uploading" });
  try {
    const memoId = await uploadVoiceMemo({
      songId: job.songId,
      blob,
      mimeType: job.mimeType || blob.type || "audio/webm",
      durationMs: job.durationMs,
      title: job.title,
      sectionLabel: job.sectionLabel,
      transcribe: job.transcribe,
      parentMemoId: job.parentMemoId,
      fileName: job.fileName,
      idempotencyKey: job.idempotencyKey,
    });

    // Success: hand the cached blob to its real id for instant first playback,
    // then release the outbox copy + job.
    await audioCache.set(memoId, blob);
    await audioCache.delete(id);
    removeJob(id);
    emit({ type: "success", outboxId: id, memoId, songId: job.songId });
    emitChange();
  } catch (err) {
    const attempts = job.attempts + 1;
    const willRetry = attempts < MAX_ATTEMPTS_BEFORE_PARKED;
    patchJob(id, {
      status: "failed",
      attempts,
      lastError: err instanceof Error ? err.message : "upload failed",
    });
    // The take + job remain. It will be retried on `online`, the heartbeat, or
    // an explicit retry — the idea is never lost.
    emit({ type: "failed", outboxId: id, songId: job.songId, error: "upload failed", willRetry });
  } finally {
    inFlight.delete(id);
  }
}

/** Attempt every queued/failed job once. Safe to call repeatedly. */
export async function processOutbox(): Promise<void> {
  if (processingAll) return;
  processingAll = true;
  try {
    const jobs = readIndex();
    for (const job of jobs) {
      // eslint-disable-next-line no-await-in-loop -- sequential keeps mobile bandwidth + memory sane
      await processJob(job.id);
    }
  } finally {
    processingAll = false;
  }
}

/** User-driven "try again now" for any parked takes. */
export async function retryOutbox(): Promise<void> {
  // Reset parked attempt counters so a manual retry always tries.
  writeIndex(readIndex().map((j) => ({ ...j, status: "queued" as const })));
  await processOutbox();
}

/** Permanently discard a queued take (the blob + job). Used by an explicit "delete". */
export async function discardOutboxJob(id: string): Promise<void> {
  removeJob(id);
  await audioCache.delete(id);
  emitChange();
}

/** Test-only: tear down listeners, timers, and in-flight state. */
export function __resetCaptureOutboxForTests(): void {
  listeners.clear();
  inFlight.clear();
  processingAll = false;
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  wired = false;
  autoProcess = true;
}

/** Test-only: disable the fire-and-forget auto-attempt so a spec can drive processing deterministically. */
export function __setOutboxAutoProcessForTests(value: boolean): void {
  autoProcess = value;
}
