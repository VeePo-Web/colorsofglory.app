// Local-first snapshot of the memory bundle — instant cold opens.
//
// Every great PKM (Obsidian included) is local-first: your notes render from
// the device before the network is even consulted. This module gives the
// Memory surface the same feel: the last fetched bundle is snapshotted to
// localStorage and served as placeholder data on the next open — content in
// ~0ms, silently revalidated by the normal query. Privacy-safe by
// construction: a snapshot is only ever served to the same signed-in user
// that saved it (checked synchronously against the Supabase auth token).

import { buildMemoryGraph } from "./buildGraph";
import type { MemoryGraph, MemoryRawBundle } from "./memoryTypes";

const SNAPSHOT_KEY = "cog:memory:snapshot";
/** Stay well under localStorage quotas; a huge catalog just skips the cache. */
const MAX_SNAPSHOT_BYTES = 2_500_000;

interface Snapshot {
  v: 1;
  userId: string;
  savedAt: string;
  bundle: MemoryRawBundle;
}

/**
 * The signed-in user's id, synchronously, from the Supabase session that the
 * JS client persists in localStorage (`sb-<ref>-auth-token`). Returns null
 * when signed out or unreadable — in which case no snapshot is served.
 */
export function currentUserIdSync(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        user?: { id?: unknown };
        currentSession?: { user?: { id?: unknown } };
      };
      const id = parsed.user?.id ?? parsed.currentSession?.user?.id;
      if (typeof id === "string" && id) return id;
    }
  } catch {
    /* private mode / malformed token — treat as signed out */
  }
  return null;
}

/** Persist the latest bundle for instant next-open. Fail-soft, size-capped. */
export function saveMemorySnapshot(bundle: MemoryRawBundle): void {
  if (!bundle.userId) return;
  try {
    const snapshot: Snapshot = {
      v: 1,
      userId: bundle.userId,
      savedAt: new Date().toISOString(),
      bundle,
    };
    const json = JSON.stringify(snapshot);
    if (json.length > MAX_SNAPSHOT_BYTES) return;
    localStorage.setItem(SNAPSHOT_KEY, json);
  } catch {
    /* quota / private mode — the feature just stays quiet */
  }
}

/**
 * Load the snapshot for the CURRENT user, rebuilt into a full graph.
 * Returns undefined (never a stranger's data) on any mismatch or error —
 * exactly the shape `useQuery`'s `placeholderData` wants.
 */
export function loadMemorySnapshot(): { graph: MemoryGraph; bundle: MemoryRawBundle } | undefined {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return undefined;
    const snapshot = JSON.parse(raw) as Snapshot;
    if (snapshot.v !== 1 || !snapshot.userId || !snapshot.bundle) return undefined;
    const uid = currentUserIdSync();
    if (!uid || uid !== snapshot.userId) return undefined;
    return { graph: buildMemoryGraph(snapshot.bundle), bundle: snapshot.bundle };
  } catch {
    return undefined;
  }
}
