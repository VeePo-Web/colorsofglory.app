import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSongSheet, saveSongSheet, seedSheetFromCapture, emitSheetEvent } from "@/integrations/cog/sheet";
import {
  type SheetDoc,
  type SheetEventDraft,
  docFromChordPro,
} from "@/lib/chords/sheetState";

/**
 * Sheet persistence for the Lyric & Chord editor. The DATABASE is the source
 * of truth; localStorage is only an offline cache/queue:
 *   • every change mirrors to the cache so an interrupted session recovers,
 *   • a failed save keeps the doc pending locally and retries on reconnect,
 *   • on load, an unsynced local edit newer than the server wins (the user's
 *     words are never sacrificed to a stale server row) and is saved up.
 * A transpose/capo/display change never dirties the doc — those live in view
 * state on the page, not here.
 */

export type SheetSaveState = "idle" | "saving" | "saved" | "offline";
export type SheetLoadState = "loading" | "ready" | "error";

const SAVE_DEBOUNCE_MS = 1200;

const cacheKey = (songId: string) => `cog-sheet-cache:${songId}`;
const legacyDraftKey = (songId: string) => `cog-sheet-draft:${songId}`;

type SheetCache = { doc: SheetDoc; updatedAt: string; dirty: boolean };

function readCache(songId: string): SheetCache | null {
  try {
    const raw = localStorage.getItem(cacheKey(songId));
    return raw ? (JSON.parse(raw) as SheetCache) : null;
  } catch {
    return null;
  }
}

function writeCache(songId: string, cache: SheetCache) {
  try {
    localStorage.setItem(cacheKey(songId), JSON.stringify(cache));
  } catch {
    /* cache is best-effort; never block editing */
  }
}

/** One-time migration of the pre-persistence localStorage ChordPro draft. */
function readLegacyDraft(songId: string): SheetDoc | null {
  try {
    const raw = localStorage.getItem(legacyDraftKey(songId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as { source?: string; sourceKey?: string };
    if (!draft.source?.trim()) return null;
    return docFromChordPro({ songId, key: draft.sourceKey ?? "C" }, draft.source);
  } catch {
    return null;
  }
}

export function useSongSheet(songId: string) {
  const queryClient = useQueryClient();
  const [doc, setDocState] = useState<SheetDoc | null>(null);
  const [loadState, setLoadState] = useState<SheetLoadState>("loading");
  const [saveState, setSaveState] = useState<SheetSaveState>("idle");

  const lastSavedRef = useRef<SheetDoc | null>(null);
  const docRef = useRef<SheetDoc | null>(null);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const query = useQuery({
    queryKey: ["song-sheet", songId],
    queryFn: () => getSongSheet(songId),
    enabled: Boolean(songId),
    staleTime: 30_000,
  });

  const persist = useCallback(async () => {
    const current = docRef.current;
    if (!current || savingRef.current) return;
    savingRef.current = true;
    setSaveState("saving");
    try {
      const { savedAt } = await saveSongSheet(songId, current, lastSavedRef.current);
      lastSavedRef.current = current;
      // Only clear dirty if nothing changed while the save was in flight.
      if (docRef.current === current) {
        dirtyRef.current = false;
        writeCache(songId, { doc: current, updatedAt: savedAt, dirty: false });
        setSaveState("saved");
      } else {
        writeCache(songId, { doc: docRef.current, updatedAt: savedAt, dirty: true });
        savingRef.current = false;
        void persist();
        return;
      }
      queryClient.setQueryData(["song-sheet", songId], { doc: current, updatedAt: savedAt });
    } catch {
      // Offline / failed — the doc stays queued in the cache; retried on
      // reconnect or the next edit. Typing is never blocked on the network.
      setSaveState("offline");
    } finally {
      savingRef.current = false;
    }
  }, [songId, queryClient]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void persist(), SAVE_DEBOUNCE_MS);
  }, [persist]);

  /** Commit a new doc (from a sheetState op) and queue autosave + events. */
  const setDoc = useCallback(
    (next: SheetDoc, events: Array<SheetEventDraft | null> = []) => {
      docRef.current = next;
      dirtyRef.current = true;
      setDocState(next);
      writeCache(songId, { doc: next, updatedAt: new Date().toISOString(), dirty: true });
      for (const draft of events) if (draft) void emitSheetEvent(songId, draft);
      scheduleSave();
    },
    [songId, scheduleSave],
  );

  // Initial load + reconcile (server vs unsynced local edit).
  useEffect(() => {
    if (!query.isSuccess && !query.isError) return;
    if (docRef.current) return; // already initialized for this song

    const init = async () => {
      if (query.isError) {
        // Server unreachable — fall back to the local cache so the writer can
        // keep working; saves will sync when the connection returns.
        const cache = readCache(songId);
        if (cache) {
          docRef.current = cache.doc;
          setDocState(cache.doc);
          dirtyRef.current = cache.dirty;
          setLoadState("ready");
          setSaveState(cache.dirty ? "offline" : "idle");
          return;
        }
        setLoadState("error");
        return;
      }

      const server = query.data!;
      const cache = readCache(songId);
      const cacheWins =
        cache?.dirty &&
        (!server.updatedAt || new Date(cache.updatedAt) >= new Date(server.updatedAt));

      if (cacheWins && cache) {
        // Unsynced offline edit — the user's words win; push them up.
        docRef.current = cache.doc;
        setDocState(cache.doc);
        dirtyRef.current = true;
        setLoadState("ready");
        scheduleSave();
        return;
      }

      if (server.doc) {
        docRef.current = server.doc;
        lastSavedRef.current = server.doc;
        setDocState(server.doc);
        writeCache(songId, { doc: server.doc, updatedAt: server.updatedAt ?? new Date().toISOString(), dirty: false });
        setLoadState("ready");
        return;
      }

      // Empty on the server: seed from the song's real captured words (C2→C3),
      // falling back to any pre-persistence local ChordPro draft. The seed is
      // persisted as the song's first real sheet, not a transient preview.
      try {
        const seeded = (await seedSheetFromCapture(songId)) ?? readLegacyDraft(songId);
        if (seeded) {
          docRef.current = seeded;
          dirtyRef.current = true;
          setDocState(seeded);
          setLoadState("ready");
          scheduleSave();
          return;
        }
      } catch {
        /* seeding is best-effort — a blank sheet is a fine outcome */
      }
      setDocState(null);
      setLoadState("ready");
    };

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess, query.isError, songId]);

  // Retry pending saves when the connection returns.
  useEffect(() => {
    const onOnline = () => {
      if (dirtyRef.current) void persist();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [persist]);

  // Flush a pending debounce when the tab hides (best-effort last write).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) void persist();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [persist]);

  return { doc, setDoc, loadState, saveState };
}
