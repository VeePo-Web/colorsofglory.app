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

/** Serializable, pipeline-specific extras (e.g. a section id, waveform peaks). */
export type OutboxExtra = Record<string, string | number | boolean | null | number[] | undefined>;

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
  /**
   * Which registered uploader pipeline sends this take. Serializable so a job
   * can be retried after a full reload. Defaults to the voiceApi pipeline.
   */
  uploaderKey?: string;
  /** Pipeline-specific data the uploader needs (kept JSON-serializable). */
  extra?: OutboxExtra;
  /** Stable across retries so the backend dedupes a re-sent take. */
  idempotencyKey: string;
  status: "queued" | "uploading" | "failed";
  attempts: number;
  createdAt: string;
  lastError?: string;
}

/**
 * An uploader sends a queued take through a specific backend pipeline and
 * returns the created memo id. Registered by key so jobs stay serializable and
 * any capture surface (in-song, brainstorm, …) can plug in its own pipeline
 * without the outbox knowing the details.
 */
export type OutboxUploader = (job: OutboxJob, blob: Blob) => Promise<string>;

const DEFAULT_UPLOADER_KEY = "voiceApi";
const uploaders: Record<string, OutboxUploader> = {
  // The default in-song pipeline (recorded takes + file imports on the Voice tab).
  // Real-audio peaks + the real section id ride in the serializable `extra` so
  // they survive a reload and persist on retry too.
  [DEFAULT_UPLOADER_KEY]: (job, blob) =>
    uploadVoiceMemo({
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
      sectionId: (job.extra?.sectionId as string | undefined) ?? null,
      waveformPeaks: (job.extra?.waveformPeaks as number[] | undefined) ?? null,
    }),
};

/**
 * Register an uploader pipeline so the outbox can sync (and retry) takes through
 * it. Idempotent — calling again with the same key replaces the uploader. Call
 * once where a surface with its own pipeline mounts (e.g. brainstorm).
 */
export function registerOutboxUploader(key: string, uploader: OutboxUploader): void {
  uploaders[key] = uploader;
}

export type OutboxEvent =
  | { type: "success"; outboxId: string; memoId: string; songId: string }
  | {
      type: "failed";
      outboxId: string;
      songId: string;
      error: string;
      willRetry: boolean;
      /**
       * Why the take didn't sync — lets a surface tell apart a transient network
       * failure from an offline device or a full storage plan. `"quota_storage"`
       * means the take is RETAINED and will sync once storage is added; the UI
       * surfaces "Saved · will sync" + an "Add storage" prompt (never data loss).
       */
      reason?: "offline" | "quota_storage" | "upload";
    }
  | { type: "change"; pending: number };

/**
 * True when an upload failed because the user's storage plan is full. The seam
 * throws a `CogError` with `code === "QUOTA_EXCEEDED_STORAGE"`; we also tolerate
 * the raw slug appearing in a message so this holds even if the error wasn't
 * normalized. This is treated as RETAIN-and-retry (like offline), NOT a burned
 * attempt — the idea is never lost, it just waits for room.
 */
function isStorageQuotaError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === "string" && code === "QUOTA_EXCEEDED_STORAGE") return true;
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const lower = msg.toLowerCase();
  return (
    msg.includes("QUOTA_EXCEEDED_STORAGE") ||
    lower.includes("storage_limit_reached") ||
    lower.includes("storage_quota_exceeded") ||
    lower.includes("out of storage")
  );
}

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

/**
 * The queued/failed jobs for one song, newest first — what a surface renders as
 * optimistic "still saving" cards after a reload (the recovery sweep).
 */
export function listOutboxJobs(songId: string): OutboxJob[] {
  return readIndex()
    .filter((j) => j.songId === songId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** User-driven retry of ONE parked take (resets its attempt counter). */
export async function retryOutboxJob(id: string): Promise<void> {
  writeIndex(readIndex().map((j) => (j.id === id ? { ...j, status: "queued" as const, attempts: 0 } : j)));
  await processJob(id);
}

function ensureWired(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("online", () => void processOutbox());
  // Process any jobs left over from a previous session as soon as we load.
  // Gated by autoProcess so tests can drive processing deterministically; in
  // production autoProcess is always true.
  if (autoProcess) void processOutbox();
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
  /** Which registered pipeline syncs this take (defaults to the in-song voiceApi). */
  uploaderKey?: string;
  /** Pipeline-specific data the chosen uploader needs (JSON-serializable). */
  extra?: OutboxExtra;
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
    uploaderKey: params.uploaderKey,
    extra: params.extra,
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
    emit({ type: "failed", outboxId: id, songId: job.songId, error: "offline", willRetry: true, reason: "offline" });
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

  const upload = uploaders[job.uploaderKey ?? DEFAULT_UPLOADER_KEY];
  if (!upload) {
    // The pipeline for this take hasn't registered yet (e.g. its surface isn't
    // mounted this session). The take stays safe in the cache; it will sync once
    // the uploader registers and the next retry fires. Don't hot-loop on it.
    patchJob(id, { status: "queued" });
    return;
  }

  inFlight.add(id);
  patchJob(id, { status: "uploading" });
  try {
    const memoId = await upload(job, blob);

    // Success: hand the cached blob to its real id for instant first playback,
    // then release the outbox copy + job.
    await audioCache.set(memoId, blob);
    await audioCache.delete(id);
    removeJob(id);
    emit({ type: "success", outboxId: id, memoId, songId: job.songId });
    emitChange();
  } catch (err) {
    // Storage full is NOT a transient failure — retain the take exactly like the
    // offline case: keep it QUEUED (do NOT burn an attempt toward parking) so it
    // syncs automatically once the user adds storage. The take is never lost; the
    // surface shows "Saved · will sync" + an "Add storage" prompt off this reason.
    if (isStorageQuotaError(err)) {
      patchJob(id, { status: "queued", lastError: "QUOTA_EXCEEDED_STORAGE" });
      emit({
        type: "failed",
        outboxId: id,
        songId: job.songId,
        error: "quota_storage",
        willRetry: true,
        reason: "quota_storage",
      });
      return;
    }

    const attempts = job.attempts + 1;
    const willRetry = attempts < MAX_ATTEMPTS_BEFORE_PARKED;
    patchJob(id, {
      status: "failed",
      attempts,
      lastError: err instanceof Error ? err.message : "upload failed",
    });
    // The take + job remain. It will be retried on `online`, the heartbeat, or
    // an explicit retry — the idea is never lost.
    emit({ type: "failed", outboxId: id, songId: job.songId, error: "upload failed", willRetry, reason: "upload" });
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
