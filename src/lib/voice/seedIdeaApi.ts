import { audioCache } from "./audioCache";
import { uploadVoiceMemo } from "./voiceApi";

export interface SeedIdeaRecord {
  id: string;
  title: string;
  durationMs: number;
  storagePath: string | null;
  status: "local-only" | "uploading" | "ready" | "claimed";
  origin: "global-capture";
  createdAt: string;
}

const INDEX_KEY = "cog-seed-ideas";

function readIndex(): SeedIdeaRecord[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SeedIdeaRecord[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(records: SeedIdeaRecord[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(records));
  } catch {
    // non-fatal — the index is a convenience cache, the audio blob is the source of truth
  }
}

function updateRecord(id: string, patch: Partial<SeedIdeaRecord>): void {
  writeIndex(readIndex().map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `seed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Save a freshly captured idea. The blob is written to the local audio cache
 * BEFORE anything else touches it — the sacred promise: an idea is never lost,
 * even offline, even if the tab closes a second later.
 */
export async function saveSeedIdea(params: {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  title: string;
}): Promise<SeedIdeaRecord> {
  const id = generateId();

  await audioCache.set(id, params.blob);

  const record: SeedIdeaRecord = {
    id,
    title: params.title,
    durationMs: params.durationMs,
    storagePath: null,
    status: "local-only",
    origin: "global-capture",
    createdAt: new Date().toISOString(),
  };

  writeIndex([record, ...readIndex()]);
  return record;
}

/** List unclaimed seed ideas, newest first — the contents of the Seed Ideas shelf. */
export async function listSeedIdeas(): Promise<SeedIdeaRecord[]> {
  return readIndex()
    .filter((r) => r.status !== "claimed")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * File a seed idea into a song — uploads the cached blob through the existing,
 * working voice memo pipeline so it lands in that song's room as a first-class
 * memo. No new backend endpoints required: the seed simply graduates.
 */
export async function claimSeedIdea(params: {
  seedId: string;
  songId: string;
  sectionLabel?: string;
}): Promise<void> {
  const record = readIndex().find((r) => r.id === params.seedId);
  if (!record) return;

  const blob = await audioCache.get(params.seedId);
  if (blob) {
    updateRecord(params.seedId, { status: "uploading" });
    try {
      await uploadVoiceMemo({
        songId: params.songId,
        blob,
        mimeType: blob.type || "audio/webm",
        durationMs: record.durationMs,
        title: record.title,
        sectionLabel: params.sectionLabel ?? "Raw idea",
      });
    } catch (err) {
      updateRecord(params.seedId, { status: "local-only" });
      throw err;
    }
  }

  updateRecord(params.seedId, { status: "claimed" });
  await audioCache.delete(params.seedId);
}

/** Permanently discard a captured idea — removes both the index entry and the cached blob. */
export async function deleteSeedIdea(seedId: string): Promise<void> {
  writeIndex(readIndex().filter((r) => r.id !== seedId));
  await audioCache.delete(seedId);
}
