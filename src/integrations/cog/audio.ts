/**
 * R40 — "Press play and it plays."
 *
 * Audio in this room must feel like a tape deck, not a web page. Every take
 * lives in a private bucket, so every play used to cost a signed-URL
 * round-trip before the first sample was heard. This module removes that
 * wait entirely:
 *
 *   1. Signed URLs are minted in BATCHES (one request for a whole board).
 *   2. They are cached in memory + sessionStorage until shortly before expiry.
 *   3. The audio bytes of the take the user is most likely to press next are
 *      warmed into the browser's HTTP cache ahead of time.
 *
 * Nothing here changes what is stored or who may hear it — RLS and signed
 * URL expiry are unchanged. This is purely about latency.
 */
import { supabase } from "@/integrations/supabase/client";
import { toCogError } from "./errors";

const BUCKET = "voice-memos";
const TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // re-mint 5 min before expiry
const STORE_KEY = "cog.audio.urls.v1";

type Entry = { url: string; expires_at: number };

const mem = new Map<string, Entry>();
let hydrated = false;

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, Entry>;
    const now = Date.now();
    for (const [path, entry] of Object.entries(parsed)) {
      if (entry?.expires_at > now + REFRESH_MARGIN_MS) mem.set(path, entry);
    }
  } catch {
    /* session storage unavailable or corrupt — cache simply starts cold */
  }
}

function persist() {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(mem)));
  } catch {
    /* quota or private mode — in-memory cache still works */
  }
}

function fresh(path: string): string | null {
  hydrate();
  const entry = mem.get(path);
  if (!entry) return null;
  if (entry.expires_at - REFRESH_MARGIN_MS <= Date.now()) {
    mem.delete(path);
    return null;
  }
  return entry.url;
}

function remember(path: string, url: string) {
  mem.set(path, { url, expires_at: Date.now() + TTL_SECONDS * 1000 });
  persist();
}

/** In-flight batches, so ten cards asking at once make one request. */
const inflight = new Map<string, Promise<string | null>>();

/**
 * Mint signed URLs for many storage paths in a single request. Already-cached
 * paths are skipped. Returns a path -> url map (missing entries mean the file
 * could not be signed — render the card as unavailable, never as loading).
 */
export async function prewarmAudio(storage_paths: string[]): Promise<Record<string, string>> {
  hydrate();
  const out: Record<string, string> = {};
  const need: string[] = [];
  for (const path of Array.from(new Set(storage_paths.filter(Boolean)))) {
    const cached = fresh(path);
    if (cached) out[path] = cached;
    else need.push(path);
  }
  if (need.length === 0) return out;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(need, TTL_SECONDS);
  if (error) throw toCogError(error);
  for (const row of data ?? []) {
    if (row.signedUrl && row.path) {
      remember(row.path, row.signedUrl);
      out[row.path] = row.signedUrl;
    }
  }
  return out;
}

/**
 * The URL for one take, instantly if it is already warm. Safe to call on every
 * render — concurrent calls for the same path share one request.
 */
export async function audioUrl(storage_path: string): Promise<string | null> {
  if (!storage_path) return null;
  const cached = fresh(storage_path);
  if (cached) return cached;

  const existing = inflight.get(storage_path);
  if (existing) return existing;

  const promise = prewarmAudio([storage_path])
    .then((map) => map[storage_path] ?? null)
    .finally(() => inflight.delete(storage_path));
  inflight.set(storage_path, promise);
  return promise;
}

/** Synchronous read — use it to paint a player with zero await on mount. */
export function cachedAudioUrl(storage_path: string): string | null {
  return fresh(storage_path);
}

/**
 * Pull the first bytes of a take into the browser's HTTP cache so pressing
 * play starts sound immediately. Fire-and-forget; failures are silent.
 */
export function preloadAudioBytes(url: string, bytes = 96 * 1024): void {
  if (!url) return;
  void fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` }, cache: "force-cache" }).catch(() => {});
}

/**
 * Warm the take the user is most likely to press next (the one after the
 * current index in a listen path, takes drawer, or voice board).
 */
export async function preloadNext(storage_paths: string[], current_index: number): Promise<void> {
  const next = storage_paths[current_index + 1];
  if (!next) return;
  const url = await audioUrl(next).catch(() => null);
  if (url) preloadAudioBytes(url);
}

/** Drop everything — call on sign-out or when switching accounts. */
export function clearAudioCache(): void {
  mem.clear();
  hydrated = false;
  try {
    sessionStorage.removeItem(STORE_KEY);
  } catch {
    /* nothing to clear */
  }
}
