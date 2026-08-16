const DB_NAME = "cog-audio-cache";
const STORE_NAME = "memos";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => { db = req.result; resolve(req.result); };
    req.onerror = () => reject(req.error);
  });
}

export const audioCache = {
  async get(memoId: string): Promise<Blob | null> {
    try {
      const database = await openDB();
      return new Promise((resolve) => {
        const tx = database.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(memoId);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  async set(memoId: string, blob: Blob): Promise<void> {
    // Best-effort cache warming — safe for prefetch/playback callers only.
    // Anything that treats this store as the DURABLE home of a take must use
    // setDurable and check its answer.
    await audioCache.setDurable(memoId, blob);
  },

  /**
   * Durable write that tells the truth: resolves true only when the IDB
   * transaction COMMITTED. iOS Safari private mode / storage pressure fails
   * the put — the old set() swallowed that, so a take's only copy could be
   * reported "saved" while nothing was written (and the salvage fallback then
   * deleted). Callers holding a songwriter's only copy branch on this.
   */
  async setDurable(memoId: string, blob: Blob): Promise<boolean> {
    try {
      const database = await openDB();
      return new Promise((resolve) => {
        const tx = database.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(blob, memoId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      });
    } catch {
      return false;
    }
  },

  async prefetch(memoId: string, url: string): Promise<void> {
    try {
      // An empty URL fetches the app's own HTML (200 OK) and poisons the
      // cache under this memo id forever — refuse it, and refuse any
      // non-audio document the server hands back.
      if (!url) return;
      const existing = await audioCache.get(memoId);
      if (existing) return;
      const res = await fetch(url);
      if (!res.ok) return;
      if ((res.headers.get("content-type") ?? "").includes("text/html")) return;
      const blob = await res.blob();
      await audioCache.set(memoId, blob);
    } catch {
      // non-fatal
    }
  },

  async delete(memoId: string): Promise<void> {
    try {
      const database = await openDB();
      return new Promise((resolve) => {
        const tx = database.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(memoId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // non-fatal
    }
  },
};
