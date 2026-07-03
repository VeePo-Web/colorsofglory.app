import { audioCache } from "./audioCache";

/**
 * A capture take (recording or import) whose save FAILED in the capture scene.
 * The blob lives in IndexedDB (audioCache) under `id`; this row is the index
 * entry so the take can be recovered after a reload — the capture scene keeps
 * failed takes in React state for retry, but state dies on refresh, and a
 * captured idea must never be lost. This makes that retain durable.
 */
export interface FailedCapture {
  id: string;
  songId: string | null;
  title: string;
  durationMs: number;
  mimeType: string;
  createdAt: string;
}

const INDEX_KEY = "cog-failed-captures";

function read(): FailedCapture[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as FailedCapture[]) : [];
  } catch {
    return [];
  }
}

function write(records: FailedCapture[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(records));
  } catch {
    // non-fatal — the blob in audioCache is the source of truth
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `failcap-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Persist a failed capture take durably. The blob goes to the device cache BEFORE
 * the index row, so from the moment this resolves the take survives a reload.
 */
export async function saveFailedCapture(
  blob: Blob,
  meta: { songId: string | null; title: string; durationMs: number },
): Promise<FailedCapture> {
  const id = generateId();
  await audioCache.set(id, blob);
  const record: FailedCapture = {
    id,
    songId: meta.songId,
    title: meta.title,
    durationMs: meta.durationMs,
    mimeType: blob.type || "audio/webm",
    createdAt: new Date().toISOString(),
  };
  write([record, ...read()]);
  return record;
}

/** Newest-first failed captures — what a recovery sweep replays on load. */
export function listFailedCaptures(): FailedCapture[] {
  return read().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** Rebuild the original File from the cached blob so it can be retried. */
export async function getFailedCaptureFile(id: string): Promise<File | null> {
  const record = read().find((r) => r.id === id);
  if (!record) return null;
  const blob = await audioCache.get(id);
  if (!blob) {
    // Orphaned row (blob evicted) — sweep it so it stops haunting the list.
    write(read().filter((r) => r.id !== id));
    return null;
  }
  return new File([blob], `recovered-${id}.webm`, {
    type: record.mimeType || blob.type || "audio/webm",
  });
}

/** Retire a failed capture once it's saved or explicitly discarded. */
export async function clearFailedCapture(id: string): Promise<void> {
  write(read().filter((r) => r.id !== id));
  await audioCache.delete(id);
}

/** Clear every failed capture (the scene handles one at a time). */
export async function clearAllFailedCaptures(): Promise<void> {
  const rows = read();
  write([]);
  await Promise.all(rows.map((r) => audioCache.delete(r.id)));
}
