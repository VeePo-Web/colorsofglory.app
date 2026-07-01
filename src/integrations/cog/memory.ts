// Personal Memory Graph / Zettelkasten (Feature 33) — data layer.
//
// Read-only aggregation of the user's own songs into a private memory graph,
// plus a one-click Obsidian vault export generated entirely in the browser.
// No new tables, no backend, no AI — cheap by construction. Everything here
// is the signed-in user's accessible data (songs they're a member of); we
// never read another person's private memory.

import { supabase } from "@/integrations/supabase/client";
import { listMySongs } from "./songs";
import { buildMemoryGraph } from "@/lib/memory/buildGraph";
import { saveMemorySnapshot } from "@/lib/memory/localCache";
import { buildVault } from "@/lib/memory/obsidianVault";
import { createZip, type ZipEntry } from "@/lib/memory/zip";
import type {
  MemoryGraph,
  MemoryIdea,
  MemoryLyric,
  MemoryNote,
  MemoryPerson,
  MemoryRawBundle,
  MemorySection,
  MemorySong,
  MemoryVoiceMemo,
} from "@/lib/memory/memoryTypes";

export type { MemoryGraph } from "@/lib/memory/memoryTypes";

const EMPTY_BUNDLE = (userId: string): MemoryRawBundle => ({
  userId,
  songs: [],
  sections: [],
  notes: [],
  ideas: [],
  people: [],
  voiceMemos: [],
});

function initialsFrom(name: string | null, firstName: string | null): string {
  const source = (name ?? firstName ?? "").trim();
  if (!source) return "•";
  return (
    source
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "•"
  );
}

/** Fetch the read-only raw bundle for the signed-in user. */
export async function fetchMemoryBundle(): Promise<MemoryRawBundle> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? "";
  if (!userId) return EMPTY_BUNDLE("");

  const cards = await listMySongs();
  const ids = cards.map((c) => c.id);
  if (ids.length === 0) return EMPTY_BUNDLE(userId);

  // Enrich with key/bpm/tags (not present on the catalog card shape).
  const { data: songRows } = await supabase
    .from("songs")
    .select("id, key_signature, tempo_bpm, tags")
    .in("id", ids);
  const enrich = new Map<string, { key: string | null; bpm: number | null; tags: string[] }>();
  for (const row of (songRows ?? []) as Array<Record<string, unknown>>) {
    enrich.set(row.id as string, {
      key: (row.key_signature as string | null) ?? null,
      bpm: (row.tempo_bpm as number | null) ?? null,
      tags: ((row.tags as string[] | null) ?? []),
    });
  }

  const songs: MemorySong[] = cards.map((c) => {
    const extra = enrich.get(c.id);
    return {
      id: c.id,
      title: c.title,
      coverColor: c.cover_color,
      status: c.status,
      keySignature: extra?.key ?? null,
      tempoBpm: extra?.bpm ?? null,
      tags: extra?.tags ?? [],
      createdAt: c.created_at,
      lastActivityAt: c.last_activity_at,
    };
  });

  const [sectionsRes, notesRes, ideasRes, membersRes, memosRes, lyricsRes] = await Promise.all([
    supabase.from("song_sections").select("id, song_id, kind, label, position").in("song_id", ids),
    supabase.from("song_notes").select("id, song_id, body, section_id").in("song_id", ids),
    supabase
      .from("idea_captures")
      .select("id, song_id, title, lyric_snippet, scripture_ref, tags")
      .in("song_id", ids),
    supabase.from("song_members").select("song_id, user_id, role").in("song_id", ids),
    supabase.from("voice_memos").select("id, song_id, title").in("song_id", ids),
    // Real lyric bodies (one row per section). Fail-soft: missing/denied -> [].
    supabase.from("song_lyrics").select("song_id, section_id, plain_text").in("song_id", ids),
  ]);

  const sections: MemorySection[] = ((sectionsRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    songId: r.song_id as string,
    kind: r.kind as string,
    label: (r.label as string | null) ?? null,
    position: Number(r.position ?? 0),
  }));

  const notes: MemoryNote[] = ((notesRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    songId: r.song_id as string,
    body: (r.body as string | null) ?? "",
    sectionId: (r.section_id as string | null) ?? null,
  }));

  const ideas: MemoryIdea[] = ((ideasRes.data ?? []) as Array<Record<string, unknown>>)
    .filter((r) => r.song_id)
    .map((r) => ({
      id: r.id as string,
      songId: r.song_id as string,
      title: (r.title as string | null) ?? null,
      lyricSnippet: (r.lyric_snippet as string | null) ?? null,
      scriptureRef: (r.scripture_ref as string | null) ?? null,
      tags: ((r.tags as string[] | null) ?? []),
    }));

  const voiceMemos: MemoryVoiceMemo[] = ((memosRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    songId: r.song_id as string,
    title: (r.title as string | null) ?? null,
  }));

  // People: resolve member names via profiles.
  const memberRows = (membersRes.data ?? []) as Array<Record<string, unknown>>;
  const memberUserIds = [...new Set(memberRows.map((r) => r.user_id as string))];
  const profileMap = new Map<string, { name: string | null; first: string | null; color: string | null }>();
  if (memberUserIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, first_name, avatar_color")
      .in("user_id", memberUserIds);
    for (const p of (profiles ?? []) as Array<Record<string, unknown>>) {
      profileMap.set(p.user_id as string, {
        name: (p.display_name as string | null) ?? null,
        first: (p.first_name as string | null) ?? null,
        color: (p.avatar_color as string | null) ?? null,
      });
    }
  }

  const people: MemoryPerson[] = memberRows.map((r) => {
    const uid = r.user_id as string;
    const prof = profileMap.get(uid);
    const name = (prof?.name ?? prof?.first ?? "").trim() || "Collaborator";
    return {
      songId: r.song_id as string,
      userId: uid,
      role: r.role as string,
      name,
      initials: initialsFrom(prof?.name ?? null, prof?.first ?? null),
      color: prof?.color ?? null,
    };
  });

  const lyrics: MemoryLyric[] = ((lyricsRes.data ?? []) as Array<Record<string, unknown>>)
    .map((r) => ({
      songId: r.song_id as string,
      sectionId: r.section_id as string,
      text: (r.plain_text as string | null) ?? "",
    }))
    .filter((l) => l.text.trim().length > 0);

  return { userId, songs, sections, notes, ideas, people, voiceMemos, lyrics };
}

export interface LoadedMemory {
  graph: MemoryGraph;
  bundle: MemoryRawBundle;
}

/** Fetch + reduce into the memory graph. Keeps the bundle for vault export. */
export async function loadMemory(): Promise<LoadedMemory> {
  const bundle = await fetchMemoryBundle();
  // Local-first: snapshot for instant cold opens (fail-soft, user-scoped).
  saveMemorySnapshot(bundle);
  return { graph: buildMemoryGraph(bundle), bundle };
}

/** Build the Obsidian vault as a .zip byte array (no I/O). */
export function buildVaultZip(graph: MemoryGraph, bundle: MemoryRawBundle): Uint8Array {
  const files = buildVault(graph, bundle);
  const entries: ZipEntry[] = files.map((f) => ({ path: f.path, text: f.content }));
  return createZip(entries);
}

/** Trigger a browser download of the user's Obsidian vault. */
export function downloadVault(graph: MemoryGraph, bundle: MemoryRawBundle): void {
  const bytes = buildVaultZip(graph, bundle);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "colors-of-glory-memory.zip";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
