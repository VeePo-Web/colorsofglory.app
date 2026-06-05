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
    try {
      const database = await openDB();
      return new Promise((resolve) => {
        const tx = database.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(blob, memoId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // cache failure is non-fatal
    }
  },

  async prefetch(memoId: string, url: string): Promise<void> {
    try {
      const existing = await audioCache.get(memoId);
      if (existing) return;
      const res = await fetch(url);
      if (!res.ok) return;
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
