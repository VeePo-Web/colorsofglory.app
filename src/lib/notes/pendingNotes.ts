/**
 * Notes never-lost substrate (C5 · A4 client cache).
 *
 * localStorage is a CACHE + a retry QUEUE here — never the source of truth. The
 * DB (song_notes, via cog/notes.ts) is authoritative. Two independent concerns:
 *
 *   1. DRAFT — the in-progress compose text, mirrored as you type so an
 *      interrupted session (reload, backgrounded tab) recovers the unsaved words.
 *   2. PENDING QUEUE — notes whose write failed (offline). They render
 *      optimistically and are retried on reconnect, then cleared once the DB
 *      accepts them.
 *
 * Everything is keyed per song and is content-scoped to this device. If storage
 * is unavailable we degrade to no-ops — the pad still works online.
 */

const DRAFT_KEY = (songId: string) => `cog:notes:draft:${songId}`;
const QUEUE_KEY = (songId: string) => `cog:notes:pending:${songId}`;

export interface PendingNote {
  /** Client-side id used as the optimistic row key until the DB row replaces it. */
  tempId: string;
  body: string;
  createdAt: string;
}

// ---- Draft (unsaved compose text) ----------------------------------------

export function getDraft(songId: string): string {
  try {
    return localStorage.getItem(DRAFT_KEY(songId)) ?? "";
  } catch {
    return "";
  }
}

export function setDraft(songId: string, text: string): void {
  try {
    if (text) localStorage.setItem(DRAFT_KEY(songId), text);
    else localStorage.removeItem(DRAFT_KEY(songId));
  } catch {
    /* storage unavailable — fall back to in-memory only */
  }
}

export function clearDraft(songId: string): void {
  try {
    localStorage.removeItem(DRAFT_KEY(songId));
  } catch {
    /* ignore */
  }
}

// ---- Pending queue (offline notes awaiting the DB) ------------------------

export function listPending(songId: string): PendingNote[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY(songId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(songId: string, queue: PendingNote[]): void {
  try {
    if (queue.length) localStorage.setItem(QUEUE_KEY(songId), JSON.stringify(queue));
    else localStorage.removeItem(QUEUE_KEY(songId));
  } catch {
    /* ignore */
  }
}

/** Queue a note the network rejected. Returns the pending record (with tempId). */
export function enqueuePending(songId: string, body: string): PendingNote {
  const record: PendingNote = {
    tempId:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tmp-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
    body,
    createdAt: new Date().toISOString(),
  };
  writeQueue(songId, [record, ...listPending(songId)]);
  return record;
}

/** Drop a pending note once its real DB row exists (or it's abandoned). */
export function removePending(songId: string, tempId: string): void {
  writeQueue(
    songId,
    listPending(songId).filter((n) => n.tempId !== tempId),
  );
}
