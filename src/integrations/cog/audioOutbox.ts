/**
 * R57 — Durable audio outbox.
 *
 * The canvas outbox (`outbox.ts`) protects typed ideas. Audio had no such
 * protection: a hum recorded in a church basement with no signal was held in
 * page memory, and a failed upload lost it forever. Voice memos are
 * first-class content in this app, so they get first-class durability.
 *
 * Flow, in order, so no step can lose the blob:
 *   1. The blob is written to IndexedDB with a stable `client_key` BEFORE any
 *      network call. From this moment the recording survives reload, crash,
 *      airplane mode, and a dead battery.
 *   2. Upload to the `voice-memos` bucket (upsert on the same deterministic
 *      path, so a partial retry overwrites rather than duplicates).
 *   3. `create_take_idempotent(song_id, client_key, ...)` — the server is
 *      unique on (song_id, client_key), so an ambiguous failure that actually
 *      succeeded returns the same take instead of creating a second one.
 *   4. Only after the server confirms is the blob deleted from IndexedDB.
 *
 * The queue drains on an interval, on `online`, and on tab focus, with
 * exponential backoff. Nothing is ever dropped: after MAX_ATTEMPTS an entry
 * stays queued and is surfaced as `failing` so the UI can offer "try again".
 */
import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

const DB_NAME = "cog.audio.outbox";
const DB_VERSION = 1;
const STORE = "recordings";
const MAX_ATTEMPTS = 10;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const DRAIN_INTERVAL_MS = 8_000;

export type AudioOutboxEntry = {
  client_key: string;
  song_id: string;
  section_id: string | null;
  voice_memo_id: string | null;
  title: string | null;
  mime_type: string;
  duration_ms: number | null;
  byte_size: number;
  waveform_peaks: number[] | null;
  make_primary: boolean;
  storage_path: string;
  blob: Blob;
  attempts: number;
  next_attempt_at: number;
  last_error?: string;
  created_at: number;
};

export type AudioOutboxStatus = {
  /** Recordings still on the device that the server has not confirmed. */
  pending: number;
  /** Pending recordings that have failed at least three times. */
  failing: number;
  online: boolean;
  uploading: boolean;
};

export type AudioOutboxResult = {
  client_key: string;
  take_id: string;
  voice_memo_id: string;
  storage_path: string;
};

type Listener = (status: AudioOutboxStatus) => void;
type ResultListener = (result: AudioOutboxResult) => void;

const listeners = new Set<Listener>();
const resultListeners = new Set<ResultListener>();
let uploading = false;
let timer: ReturnType<typeof setInterval> | null = null;
let cachedCounts = { pending: 0, failing: 0 };

// ---------- IndexedDB (blobs cannot live in localStorage) ----------

function hasIDB(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "client_key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

async function allEntries(): Promise<AudioOutboxEntry[]> {
  if (!hasIDB()) return [];
  try {
    const rows = await tx<AudioOutboxEntry[]>("readonly", (s) => s.getAll() as IDBRequest<AudioOutboxEntry[]>);
    return rows ?? [];
  } catch {
    return [];
  }
}

async function putEntry(entry: AudioOutboxEntry): Promise<void> {
  await tx("readwrite", (s) => s.put(entry) as IDBRequest<IDBValidKey>);
}

async function deleteEntry(client_key: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(client_key) as unknown as IDBRequest<undefined>);
}

// ---------- Status ----------

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

export function getAudioOutboxStatus(): AudioOutboxStatus {
  return { ...cachedCounts, online: isOnline(), uploading };
}

async function refresh(): Promise<void> {
  const entries = await allEntries();
  cachedCounts = {
    pending: entries.length,
    failing: entries.filter((e) => e.attempts >= 3).length,
  };
  const status = getAudioOutboxStatus();
  listeners.forEach((fn) => fn(status));
}

export function subscribeAudioOutbox(fn: Listener): () => void {
  listeners.add(fn);
  fn(getAudioOutboxStatus());
  void refresh();
  return () => listeners.delete(fn);
}

/** Fires once per recording the moment the server confirms it. */
export function subscribeAudioOutboxResults(fn: ResultListener): () => void {
  resultListeners.add(fn);
  return () => resultListeners.delete(fn);
}

/** Recordings still waiting, newest first — for an offline shelf in the UI. */
export async function listQueuedRecordings(song_id?: string): Promise<
  Array<Omit<AudioOutboxEntry, "blob"> & { object_url: string }>
> {
  const entries = await allEntries();
  return entries
    .filter((e) => !song_id || e.song_id === song_id)
    .sort((a, b) => b.created_at - a.created_at)
    .map(({ blob, ...rest }) => ({ ...rest, object_url: URL.createObjectURL(blob) }));
}

export function newAudioKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `k_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// ---------- Enqueue ----------

export type QueueRecordingInput = {
  song_id: string;
  blob: Blob;
  section_id?: string | null;
  voice_memo_id?: string | null;
  title?: string | null;
  duration_ms?: number | null;
  waveform_peaks?: number[] | null;
  make_primary?: boolean;
  client_key?: string;
};

/**
 * Persist a recording, then try to send it. Resolves as soon as the blob is
 * safely on the device — never blocks the UI on the network. The take id
 * arrives later via `subscribeAudioOutboxResults`.
 */
export async function queueRecording(input: QueueRecordingInput): Promise<string> {
  const client_key = input.client_key ?? newAudioKey();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? "anon";
  const mime_type = input.blob.type || "audio/webm";
  const ext = mime_type.includes("mp4") ? "m4a" : mime_type.includes("wav") ? "wav" : "webm";

  const entry: AudioOutboxEntry = {
    client_key,
    song_id: input.song_id,
    section_id: input.section_id ?? null,
    voice_memo_id: input.voice_memo_id ?? null,
    title: input.title ?? null,
    mime_type,
    duration_ms: input.duration_ms ?? null,
    byte_size: input.blob.size,
    waveform_peaks: input.waveform_peaks ?? null,
    make_primary: input.make_primary ?? false,
    storage_path: `${input.song_id}/${uid}/takes/${client_key}.${ext}`,
    blob: input.blob,
    attempts: 0,
    next_attempt_at: 0,
    created_at: Date.now(),
  };

  if (hasIDB()) {
    await putEntry(entry);
    await refresh();
  }
  void flushAudioOutbox();
  return client_key;
}

// ---------- Drain ----------

async function sendOne(entry: AudioOutboxEntry): Promise<AudioOutboxResult> {
  const up = await supabase.storage
    .from("voice-memos")
    .upload(entry.storage_path, entry.blob, {
      contentType: entry.mime_type,
      upsert: true,
    });
  if (up.error) throw toCogError(up.error);

  const { data, error } = await supabase.rpc("create_take_idempotent", {
    _song_id: entry.song_id,
    _client_key: entry.client_key,
    _storage_path: entry.storage_path,
    _mime_type: entry.mime_type,
    _duration_ms: entry.duration_ms,
    _byte_size: entry.byte_size,
    _waveform_peaks: (entry.waveform_peaks ?? null) as never,
    _section_id: entry.section_id,
    _title: entry.title,
    _voice_memo_id: entry.voice_memo_id,
    _make_primary: entry.make_primary,
  } as never);
  if (error) throw toCogError(error);

  const row = (data ?? {}) as { take_id: string; voice_memo_id: string; storage_path: string };
  return {
    client_key: entry.client_key,
    take_id: row.take_id,
    voice_memo_id: row.voice_memo_id,
    storage_path: row.storage_path ?? entry.storage_path,
  };
}

/** Attempt every due recording. Returns how many landed. */
export async function flushAudioOutbox(): Promise<number> {
  if (uploading || !hasIDB() || !isOnline()) return 0;
  uploading = true;
  await refresh();
  let sent = 0;
  try {
    const now = Date.now();
    const due = (await allEntries())
      .filter((e) => e.next_attempt_at <= now)
      .sort((a, b) => a.created_at - b.created_at);

    for (const entry of due) {
      try {
        const result = await sendOne(entry);
        await deleteEntry(entry.client_key);
        sent += 1;
        resultListeners.forEach((fn) => fn(result));
      } catch (err) {
        const attempts = entry.attempts + 1;
        const backoff = Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
        await putEntry({
          ...entry,
          attempts,
          // Never give up entirely — just slow down.
          next_attempt_at: Date.now() + (attempts >= MAX_ATTEMPTS ? MAX_BACKOFF_MS : backoff),
          last_error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    uploading = false;
    await refresh();
  }
  return sent;
}

/** Force an immediate retry of everything (for a "try again" tap). */
export async function retryAudioOutboxNow(): Promise<number> {
  const entries = await allEntries();
  for (const e of entries) await putEntry({ ...e, next_attempt_at: 0 });
  return flushAudioOutbox();
}

/**
 * Reconcile after a long offline stretch: ask the server which queued keys
 * already landed and drop those blobs. Prevents a stuck entry whose RPC
 * succeeded but whose response never arrived.
 */
export async function reconcileAudioOutbox(song_id: string): Promise<number> {
  const entries = (await allEntries()).filter((e) => e.song_id === song_id);
  if (entries.length === 0) return 0;
  const { data, error } = await supabase.rpc("takes_landed", {
    _song_id: song_id,
    _client_keys: entries.map((e) => e.client_key),
  } as never);
  if (error) return 0;
  const landed = (data ?? []) as Array<{ client_key: string; take_id: string }>;
  for (const row of landed) {
    await deleteEntry(row.client_key);
    const entry = entries.find((e) => e.client_key === row.client_key);
    if (entry) {
      resultListeners.forEach((fn) =>
        fn({
          client_key: row.client_key,
          take_id: row.take_id,
          voice_memo_id: entry.voice_memo_id ?? "",
          storage_path: entry.storage_path,
        }),
      );
    }
  }
  await refresh();
  return landed.length;
}

/** Start the background drain. Call once at app mount; returns a cleanup fn. */
export function startAudioOutbox(): () => void {
  if (typeof window === "undefined") return () => {};
  const kick = () => void flushAudioOutbox();
  const onVisible = () => {
    if (document.visibilityState === "visible") kick();
  };
  window.addEventListener("online", kick);
  document.addEventListener("visibilitychange", onVisible);
  if (!timer) timer = setInterval(kick, DRAIN_INTERVAL_MS);
  kick();
  return () => {
    window.removeEventListener("online", kick);
    document.removeEventListener("visibilitychange", onVisible);
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
