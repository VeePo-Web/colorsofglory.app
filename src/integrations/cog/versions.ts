/**
 * Version history data seam (A3 · E3 lane).
 *
 * The snapshot timeline at /songs/:id/versions is backed by `song_versions`.
 * This module is the ONLY place the version surface talks to Supabase — no
 * component ever queries `song_versions` directly.
 *
 * THE RESTORE LAW (docs/VERSION-CONTRACT.md): restoring is NEVER an overwrite.
 * `restoreVersion` first snapshots the CURRENT state (the pre-restore safety
 * version), then applies the target snapshot, then records the restore as a
 * new `restore_point` version whose parent is the restored version. Nothing is
 * ever deleted; the original (the song's first version) is protected forever.
 * This module exposes NO delete — the UI never offers one.
 *
 * Snapshot shape (v1, rows-based and editor-agnostic):
 *   { v: 1, song: { title }, sections: [{ id, kind, label, position,
 *     lyrics: { content, plain_text } | null }] }
 * `song_sections` + `song_lyrics` rows are the DB truth for the song's words
 * no matter which editor wrote them; `content` is preserved verbatim (opaque
 * Json), so chord-anchor payloads round-trip losslessly. Voice memo AUDIO is
 * immutable storage and is never destroyed by any write, so it needs no
 * restore path. Unreadable/foreign snapshots parse to null and render as a
 * calm "kept safe, can't be previewed" card — never raw JSON, never a crash.
 *
 * Lineage: every new snapshot's parent_version_id is the current head, so the
 * chain is contiguous and the ONLY parentless version is the very first — the
 * Original. A restore branches: its parent is the version it restored.
 *
 * Version kinds:
 *   manual        — a songwriter's "Save a version" (optional label)
 *   auto          — system safety snapshots (the seeded "Original", the
 *                   "Before restoring vN" pre-restore capture)
 *   restore_point — the version created by a restore (parent = restored one)
 *
 * Activity (E3 → E2): the DB trigger `touch_activity_on_song_versions` already
 * bumps song activity on insert. Client kinds `version_saved` /
 * `version_restored` are documented for E2, but the feed is server-driven and
 * read-only from the client today, so the emit below is a deliberate no-op —
 * a version write never depends on it. E2 renders the event; E3 never does.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { CogError } from "./songs";

/** Generated row — canonical domain type until a shared @/types barrel exists. */
export type SongVersion = Database["public"]["Tables"]["song_versions"]["Row"];
export type VersionKind = SongVersion["kind"];

type SectionKind = Database["public"]["Enums"]["section_kind"];

function asCogError(err: { code?: string | null; message?: string } | null | undefined): CogError {
  return new CogError(err?.code ?? "INTERNAL", err?.message ?? "Something went wrong.");
}

// ─── Snapshot codec (pure — unit-tested in src/test/version-history.test.ts) ─

export type SnapshotSection = {
  id: string;
  kind: SectionKind;
  label: string | null;
  position: number;
  lyrics: { content: Json; plain_text: string } | null;
};

export type SongSnapshotV1 = {
  v: 1;
  song: { title: string | null };
  sections: SnapshotSection[];
};

/** Decode a stored snapshot. Returns null for unreadable/foreign payloads —
 *  callers render a calm fallback, never raw JSON. */
export function parseSnapshot(raw: Json | null | undefined): SongSnapshotV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const snap = raw as Record<string, unknown>;
  if (snap.v !== 1 || !Array.isArray(snap.sections)) return null;
  const song = (snap.song ?? {}) as Record<string, unknown>;
  const sections: SnapshotSection[] = [];
  for (const s of snap.sections as Array<Record<string, unknown>>) {
    if (!s || typeof s.id !== "string" || typeof s.position !== "number") return null;
    const lyrics = s.lyrics as Record<string, unknown> | null | undefined;
    sections.push({
      id: s.id,
      kind: (typeof s.kind === "string" ? s.kind : "other") as SectionKind,
      label: typeof s.label === "string" ? s.label : null,
      position: s.position,
      lyrics:
        lyrics && typeof lyrics.plain_text === "string"
          ? { content: (lyrics.content ?? null) as Json, plain_text: lyrics.plain_text }
          : null,
    });
  }
  return {
    v: 1,
    song: { title: typeof song.title === "string" ? song.title : null },
    sections: sections.sort((a, b) => a.position - b.position),
  };
}

const KIND_TITLES: Partial<Record<string, string>> = {
  intro: "Intro",
  verse: "Verse",
  pre_chorus: "Pre-Chorus",
  chorus: "Chorus",
  bridge: "Bridge",
  hook: "Hook",
  tag: "Tag",
  outro: "Outro",
  other: "Section",
};

function sectionDisplayLabel(s: SnapshotSection): string {
  return s.label || KIND_TITLES[s.kind] || "Section";
}

function linesOf(s: SnapshotSection): string[] {
  return (s.lyrics?.plain_text ?? "").split("\n").filter((l) => l.trim().length > 0);
}

/** Count chord anchors when `content` carries the known {v:1, lines:[{anchors}]}
 *  payload; foreign content shapes just count as zero chords. */
function chordCountOf(s: SnapshotSection): number {
  const content = s.lyrics?.content as
    | { v?: unknown; lines?: Array<{ anchors?: unknown[] }> }
    | null
    | undefined;
  if (!content || content.v !== 1 || !Array.isArray(content.lines)) return 0;
  return content.lines.reduce(
    (n, l) => n + (Array.isArray(l?.anchors) ? l.anchors.length : 0),
    0,
  );
}

export type SnapshotSummary = {
  title: string | null;
  sectionCount: number;
  lineCount: number;
  chordCount: number;
  /** Ordered section labels with per-section line counts, for the detail sheet. */
  sections: Array<{ label: string; lineCount: number }>;
  isEmpty: boolean;
};

/** Human-readable summary of what a snapshot held. Pure. */
export function summarizeSnapshot(snapshot: SongSnapshotV1): SnapshotSummary {
  const sections = snapshot.sections.map((s) => ({
    label: sectionDisplayLabel(s),
    lineCount: linesOf(s).length,
  }));
  return {
    title: snapshot.song.title,
    sectionCount: sections.length,
    lineCount: sections.reduce((n, s) => n + s.lineCount, 0),
    chordCount: snapshot.sections.reduce((n, s) => n + chordCountOf(s), 0),
    sections,
    isEmpty: sections.length === 0,
  };
}

/** The Original = the song's first-ever version (lowest version_number).
 *  Lineage chaining means it is also the only parentless version, but the
 *  number is the robust test (parent FKs null out if a parent is removed). */
export function findOriginalId(versions: SongVersion[]): string | null {
  if (versions.length === 0) return null;
  return versions.reduce((min, v) => (v.version_number < min.version_number ? v : min)).id;
}

// ─── Activity contract (E3 → E2) ─────────────────────────────────────────────

export type VersionActivityKind = "version_saved" | "version_restored";

function emitVersionActivity(
  _kind: VersionActivityKind,
  _ids: { song_id: string; version_id: string },
): void {
  // no-op until E2 publishes a client emit path / trigger. The DB trigger
  // touch_activity_on_song_versions already bumps song activity on insert.
  // Payloads are IDs + kind only — never snapshot content.
}

// ─── Read ────────────────────────────────────────────────────────────────────

/** All versions of a song, newest first (RLS: members only). */
export async function listVersions(songId: string): Promise<SongVersion[]> {
  const { data, error } = await supabase
    .from("song_versions")
    .select("*")
    .eq("song_id", songId)
    .order("version_number", { ascending: false });
  if (error) throw asCogError(error);
  return (data ?? []) as SongVersion[];
}

export async function getVersion(id: string): Promise<SongVersion> {
  const { data, error } = await supabase
    .from("song_versions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw asCogError(error);
  if (!data) throw new CogError("SONG_NOT_FOUND", "That version could not be found.");
  return data as SongVersion;
}

/** Current head = highest version_number, or null when the song has no versions. */
async function getHead(songId: string): Promise<SongVersion | null> {
  const { data, error } = await supabase
    .from("song_versions")
    .select("*")
    .eq("song_id", songId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw asCogError(error);
  return (data as SongVersion | null) ?? null;
}

/** Capture the song's current restorable state as a v1 snapshot. */
export async function captureCurrentState(songId: string): Promise<SongSnapshotV1> {
  const [titleRes, sectionsRes, lyricsRes] = await Promise.all([
    supabase.from("songs").select("title").eq("id", songId).maybeSingle(),
    supabase
      .from("song_sections")
      .select("id, kind, label, position")
      .eq("song_id", songId)
      .order("position", { ascending: true }),
    supabase.from("song_lyrics").select("section_id, content, plain_text").eq("song_id", songId),
  ]);
  if (titleRes.error) throw asCogError(titleRes.error);
  if (sectionsRes.error) throw asCogError(sectionsRes.error);
  if (lyricsRes.error) throw asCogError(lyricsRes.error);

  const lyricsBySection = new Map(
    (lyricsRes.data ?? []).map((row) => [
      row.section_id,
      { content: row.content as Json, plain_text: row.plain_text ?? "" },
    ]),
  );
  return {
    v: 1,
    song: { title: titleRes.data?.title ?? null },
    sections: (sectionsRes.data ?? []).map((s) => ({
      id: s.id,
      kind: s.kind,
      label: s.label,
      position: s.position,
      lyrics: lyricsBySection.get(s.id) ?? null,
    })),
  };
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new CogError("UNAUTHENTICATED", "Please sign in and try again.");
  return uid;
}

/** Bring the live section/lyric rows to exactly the snapshot's state.
 *  Only called from restoreVersion, AFTER the pre-restore state is saved. */
async function applySnapshot(songId: string, snap: SongSnapshotV1, uid: string): Promise<void> {
  const now = new Date().toISOString();

  const existingRes = await supabase.from("song_sections").select("id").eq("song_id", songId);
  if (existingRes.error) throw asCogError(existingRes.error);
  const keep = new Set(snap.sections.map((s) => s.id));
  const removedIds = (existingRes.data ?? []).map((r) => r.id).filter((id) => !keep.has(id));

  if (snap.sections.length > 0) {
    const { error: secErr } = await supabase.from("song_sections").upsert(
      snap.sections.map((s) => ({
        id: s.id,
        song_id: songId,
        kind: s.kind,
        label: s.label,
        position: s.position,
        created_by_user_id: uid,
        updated_at: now,
      })),
      { onConflict: "id" },
    );
    if (secErr) throw asCogError(secErr);

    const withLyrics = snap.sections.filter((s) => s.lyrics);
    if (withLyrics.length > 0) {
      const { error: lyrErr } = await supabase.from("song_lyrics").upsert(
        withLyrics.map((s) => ({
          song_id: songId,
          section_id: s.id,
          content: s.lyrics!.content as never,
          plain_text: s.lyrics!.plain_text,
          updated_by_user_id: uid,
          updated_at: now,
        })),
        { onConflict: "section_id" },
      );
      if (lyrErr) throw asCogError(lyrErr);
    }

    const lyricless = snap.sections.filter((s) => !s.lyrics).map((s) => s.id);
    if (lyricless.length > 0) {
      await supabase.from("song_lyrics").delete().eq("song_id", songId).in("section_id", lyricless);
    }
  }

  if (removedIds.length > 0) {
    await supabase.from("song_lyrics").delete().eq("song_id", songId).in("section_id", removedIds);
    const { error: delErr } = await supabase
      .from("song_sections")
      .delete()
      .eq("song_id", songId)
      .in("id", removedIds);
    if (delErr) throw asCogError(delErr);
  }
}

// ─── Write ───────────────────────────────────────────────────────────────────

type CreateSnapshotOpts = {
  kind?: VersionKind;
  label?: string | null;
  description?: string | null;
  /** Explicit lineage. Omit to chain onto the current head (undefined ≠ null:
   *  null forces a root — only the seeded Original ever passes it). */
  parentVersionId?: string | null;
  /** Pre-captured state (restore passes one); omitted → captured now. */
  snapshot?: SongSnapshotV1;
};

/**
 * Save a new version. version_number is assigned server-side (trigger), the
 * parent defaults to the current head so lineage stays contiguous.
 */
export async function createSnapshot(
  songId: string,
  opts: CreateSnapshotOpts = {},
): Promise<SongVersion> {
  const uid = await requireUserId();
  const snapshot = opts.snapshot ?? (await captureCurrentState(songId));
  const parent =
    opts.parentVersionId !== undefined
      ? opts.parentVersionId
      : ((await getHead(songId))?.id ?? null);

  const { data, error } = await supabase
    .from("song_versions")
    .insert({
      song_id: songId,
      kind: opts.kind ?? "manual",
      label: opts.label?.trim() || null,
      description: opts.description?.trim() || null,
      snapshot: snapshot as unknown as Json,
      parent_version_id: parent,
      created_by_user_id: uid,
    })
    .select("*")
    .single();
  if (error) throw asCogError(error);
  emitVersionActivity("version_saved", { song_id: songId, version_id: data.id });
  return data as SongVersion;
}

/**
 * Guarantee the Original exists: if the song has no versions yet, seed one
 * from the current state (kind "auto", label "Original", no parent). Safe
 * against the concurrent-first-visit race — a unique version_number collision
 * just refetches. Returns the original (existing or seeded), or null when the
 * insert lost the race and the refetch also came back empty.
 */
export async function ensureOriginalVersion(songId: string): Promise<SongVersion | null> {
  const existing = await listVersions(songId);
  if (existing.length > 0) {
    const id = findOriginalId(existing);
    return existing.find((v) => v.id === id) ?? null;
  }
  try {
    return await createSnapshot(songId, {
      kind: "auto",
      label: "Original",
      description: "The song as it was when version history began. Always safe.",
      parentVersionId: null,
    });
  } catch {
    // Lost a race (or RLS said no) — the timeline read is the source of truth.
    const after = await listVersions(songId);
    const id = findOriginalId(after);
    return after.find((v) => v.id === id) ?? null;
  }
}

export type RestoreResult = {
  /** The safety snapshot of the state as it was JUST BEFORE the restore —
   *  restoring this version is Undo. */
  preRestoreVersion: SongVersion;
  /** The new restore_point version (parent = the version that was restored). */
  restoredVersion: SongVersion;
};

/**
 * Restore the song to an earlier version — non-destructively.
 *
 * Order is the safety guarantee:
 *   1. capture + save the CURRENT state ("Before restoring vN", kind auto) —
 *      preserve FIRST, so even a failure mid-restore loses nothing;
 *   2. bring the live section/lyric rows to the target snapshot's state;
 *   3. record the restore as a restore_point whose parent is the restored
 *      version ("Restored from vN").
 * If step 3 fails after step 2 succeeded, the song state is correct and the
 * pre-restore version exists — only the restore marker is missing (the caller
 * surfaces the error; retrying just re-runs the whole safe sequence).
 */
export async function restoreVersion(songId: string, versionId: string): Promise<RestoreResult> {
  const target = await getVersion(versionId);
  if (target.song_id !== songId) {
    throw new CogError("SONG_NOT_FOUND", "That version belongs to a different song.");
  }
  const targetSnap = parseSnapshot(target.snapshot);
  if (!targetSnap) {
    throw new CogError("INVALID_INPUT", "This snapshot can't be read, so it can't be restored.");
  }

  const uid = await requireUserId();

  // 1) Preserve the current state first — nothing can be lost after this line.
  const currentSnap = await captureCurrentState(songId);
  const head = await getHead(songId);
  const preRestoreVersion = await createSnapshot(songId, {
    kind: "auto",
    label: `Before restoring v${target.version_number}`,
    parentVersionId: head?.id ?? null,
    snapshot: currentSnap,
  });

  // 2) Bring the song to the restored state.
  await applySnapshot(songId, targetSnap, uid);

  // 3) Record the restore, branched from the version it revived.
  const restoredVersion = await createSnapshot(songId, {
    kind: "restore_point",
    label: target.label ? `Restored: ${target.label}` : `Restored from v${target.version_number}`,
    parentVersionId: target.id,
    snapshot: targetSnap,
  });

  emitVersionActivity("version_restored", { song_id: songId, version_id: restoredVersion.id });
  return { preRestoreVersion, restoredVersion };
}
