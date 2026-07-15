/**
 * dedication — the song's optional one-line "for …" ("for the youth night,"
 * "for the Sunday after Mom's surgery"). Pure, unfailing text: no validation
 * beyond a soft length cap, empty means absent, and a save can NEVER fail
 * loudly or block anything.
 *
 * "Pure local text," reconciled: the dedication is PERSISTED TO THE SONG
 * (`songs.dedication` — see the back-end ask in docs/features/
 * DEDICATION-progress.md) so it rides in the header and on credits/export for
 * collaborators and survives a device change. "Pure/local" here means SIMPLE
 * and UNFAILING — plain text, saved offline-first through this device queue,
 * never a network gate, never an error state — NOT localStorage-only. (If a
 * strictly private/device-local variant is ever wanted, it's a one-line swap:
 * stop calling setSongDedication and this store IS that variant.)
 *
 * The device store is both the offline queue and the render cache:
 *   - a save writes locally first (pending) and syncs best-effort;
 *   - server truth, when a surface has it, is remembered here so surfaces
 *     without their own song fetch (sheet, credits) still show the line;
 *   - a pending local edit always outranks server truth until it syncs;
 *   - clearing returns the song to genuinely invisible everywhere.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { setSongDedication } from "@/integrations/cog/songs";

export const DEDICATION_MAX = 200;

/** Trim, collapse whitespace, soft-cap. Empty ⇒ null ⇒ invisible. */
export function normalizeDedication(raw: string | null | undefined): string | null {
  const text = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, DEDICATION_MAX).trim();
  return text.length > 0 ? text : null;
}

interface DedicationRecord {
  text: string | null;
  /** True while this device's edit hasn't reached the server yet. */
  pending: boolean;
  /** "local" = the writer edited on this device; "server" = remembered truth. */
  origin: "local" | "server";
  at: number;
}

const STORE_KEY = "cog-dedications";
const MAX_ENTRIES = 200;

type StoreShape = Record<string, DedicationRecord>;

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* one bad listener never breaks the rest */
    }
  });
}

function readStore(): StoreShape {
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

function writeStore(map: StoreShape): void {
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
    /* storage full/blocked — the in-session state still flows via emit() */
  }
}

/** The dedication this device should render for a song (local-first). */
export function resolveDedication(songId: string): string | null {
  if (!songId) return null;
  return readStore()[songId]?.text ?? null;
}

/**
 * How long a local record (even a synced one) outranks a caller's server
 * snapshot. Surfaces pass whatever SongDetail they fetched — which can be
 * STALE for the edit the writer made seconds ago on this very device. Within
 * this window the local record wins; after it, genuine collaborator edits
 * arriving on a fresh fetch take over.
 */
const LOCAL_RECENCY_MS = 5 * 60 * 1000;

/**
 * A surface that fetched the song (workspace, catalog) remembers the server
 * truth here so surfaces WITHOUT their own fetch (sheet, credits) show the
 * same line. A pending local edit — or any local edit fresher than the
 * recency window — is never overwritten: a stale server snapshot must not
 * resurrect a dedication the writer just changed or cleared.
 */
export function rememberServerDedication(songId: string, server: string | null): void {
  if (!songId) return;
  const map = readStore();
  const local = map[songId];
  if (local?.pending) return; // this device's unsynced edit wins for now
  // A fresh edit made ON THIS DEVICE outranks a possibly-stale server prop;
  // server-remembered records always yield to newer server truth (that's how
  // a collaborator's edit or clear arrives here).
  if (local && local.origin === "local" && Date.now() - local.at < LOCAL_RECENCY_MS) return;
  const current = local?.text ?? null;
  if (current === server) return;
  if (server === null) delete map[songId]; // absent server-side ⇒ invisible here too
  else map[songId] = { text: server, pending: false, origin: "server", at: Date.now() };
  writeStore(map);
  emit();
}

async function syncToServer(songId: string, text: string | null): Promise<void> {
  await setSongDedication(songId, text);
  const map = readStore();
  const rec = map[songId];
  // Only mark synced if this exact edit is still the latest one. A cleared
  // dedication keeps a {text: null} tombstone (not a deletion) so a stale
  // serverValue prop can't resurrect the line before the next real fetch.
  if (rec && rec.pending && rec.text === text) {
    map[songId] = { ...rec, pending: false };
    writeStore(map);
    emit();
  }
}

/**
 * Save (or clear, with empty text) a song's dedication. Optimistic and
 * UNFAILING: the local write lands instantly and the server sync retries in
 * the background (and on the next app load / reconnect). Never throws, never
 * blocks, never surfaces an error — nothing is ever lost.
 * Returns the normalized text that was applied.
 */
export function saveDedicationDurable(songId: string, raw: string | null): string | null {
  const text = normalizeDedication(raw);
  if (!songId) return text;
  const map = readStore();
  map[songId] = { text, pending: true, origin: "local", at: Date.now() };
  writeStore(map);
  emit();
  void syncToServer(songId, text).catch(() => {
    /* stays pending; flushPendingDedications retries later */
  });
  return text;
}

/** Retry every unsynced edit — called on app load and when back online. */
export function flushPendingDedications(): void {
  const map = readStore();
  for (const [songId, rec] of Object.entries(map)) {
    if (!rec.pending) continue;
    void syncToServer(songId, rec.text).catch(() => {
      /* still offline / column not live yet — keep waiting, keep the text */
    });
  }
}

export function subscribeDedications(listener: () => void): () => void {
  wireRetry();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let retryWired = false;
function wireRetry(): void {
  if (retryWired || typeof window === "undefined") return;
  retryWired = true;
  window.addEventListener("online", flushPendingDedications);
  flushPendingDedications();
}

/**
 * React view: the resolved dedication for a song, live across every surface
 * on this device, remembering server truth when the caller has it.
 *
 * Resolution order: a LOCAL RECORD (even a cleared {text: null} tombstone)
 * is this device's truth; only when no record exists does the caller's
 * serverValue fill in — so a just-cleared dedication can never be resurrected
 * by a stale prop.
 */
export function useDedication(
  songId: string,
  serverValue?: string | null,
): { text: string | null; save: (raw: string | null) => string | null } {
  const getSnapshot = useCallback(() => {
    const rec = readStore()[songId];
    if (rec) return rec.text;
    return serverValue ?? null;
  }, [songId, serverValue]);

  const text = useSyncExternalStore(subscribeDedications, getSnapshot, () => null);

  useEffect(() => {
    if (serverValue !== undefined) rememberServerDedication(songId, serverValue);
  }, [songId, serverValue]);

  return {
    text,
    save: (raw) => saveDedicationDurable(songId, raw),
  };
}

/** Test-only. */
export function __resetDedicationsForTests(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORE_KEY);
  } catch {
    /* noop */
  }
  listeners.clear();
  retryWired = false;
}
