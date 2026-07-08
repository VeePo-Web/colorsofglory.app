import { supabase } from "@/integrations/supabase/client";
import {
  type SheetDoc,
  type SheetSectionDoc,
  type SheetLineDoc,
  type SheetEventDraft,
  createDoc,
  newSheetId,
} from "@/lib/chords/sheetState";
import type { ChordAnchor } from "@/lib/chords/sheet";
import type { Mode } from "@/lib/chords/keys";

/**
 * Lyric & Chord Sheet — the A3 data seam for the editor at /songs/:id/sheet.
 * ALL Supabase access for sections/lyrics/sheet-meta lives here; the page never
 * calls supabase directly.
 *
 * Storage model
 * ─────────────
 * • song_sections   — one row per section (id, kind, label, position).
 * • song_lyrics     — one row per section (1:1 on section_id). `content` holds
 *                     the versioned line/anchor JSON below; `plain_text` is the
 *                     denormalized lyrics-only mirror (lines joined with "\n").
 * • chord_progressions — one song-level row (label "__sheet_meta__",
 *                     section_id null) whose `chords` JSON carries the sheet's
 *                     key/mode/capo/bpm/display. Chords themselves live inside
 *                     `content` as key-independent NumberChord anchors.
 *
 * `content` serialization (versioned, lossless round-trip with SheetDoc):
 *   { v: 1, lines: [{ id: string, text: string,
 *                     anchors: [{ chord: NumberChord, at: number }] }] }
 * Chords are stored as Nashville NumberChords (never letters) so transposition
 * stays free and non-destructive. `at` is the UTF-16 char offset in `text`.
 *
 * Backend notes (for the schema owner):
 * • song_sections has no `archived` column — section removal deletes the row;
 *   the emitted `section_removed` event is what version history preserves.
 * • sheet meta would ideally live on `songs` (key_signature exists but capo/
 *   display/bpm do not) — the "__sheet_meta__" progression row bridges that.
 */

const SHEET_META_LABEL = "__sheet_meta__";
const CONTENT_VERSION = 1;

type ContentV1 = {
  v: 1;
  lines: Array<{ id: string; text: string; anchors: ChordAnchor[] }>;
};

type SheetMetaV1 = {
  v: 1;
  key: string;
  mode: Mode;
  originalKey: string;
  capo: number;
  bpm?: number;
  display: "letters" | "numbers";
};

export type SongSheet = {
  /** null when the song has no sections yet (a genuinely blank sheet). */
  doc: SheetDoc | null;
  /** Newest updated_at across sections/lyrics/meta — used for offline reconcile. */
  updatedAt: string | null;
};

// Loose handle for rows/filters the generated types don't fully model.
const db = supabase as unknown as { from: (t: string) => any };

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

// ─── Decode ──────────────────────────────────────────────────────────────────

function decodeContent(raw: unknown): SheetLineDoc[] {
  const content = raw as ContentV1 | null | undefined;
  if (!content || content.v !== CONTENT_VERSION || !Array.isArray(content.lines)) return [];
  return content.lines.map((l) => ({
    id: typeof l.id === "string" && l.id ? l.id : newSheetId(),
    text: typeof l.text === "string" ? l.text : "",
    anchors: Array.isArray(l.anchors)
      ? l.anchors
          .filter((a) => a && typeof a.at === "number" && a.chord && typeof a.chord.degree === "number")
          .map((a) => ({ chord: a.chord, at: Math.max(0, Math.min((l.text ?? "").length, a.at)) }))
          .sort((a, b) => a.at - b.at)
      : [],
  }));
}

function encodeContent(lines: SheetLineDoc[]): ContentV1 {
  return {
    v: CONTENT_VERSION,
    lines: lines.map((l) => ({ id: l.id, text: l.text, anchors: l.anchors })),
  };
}

function plainText(lines: SheetLineDoc[]): string {
  return lines.map((l) => l.text).join("\n");
}

// ─── Read ────────────────────────────────────────────────────────────────────

export async function getSongSheet(songId: string): Promise<SongSheet> {
  const [sectionsRes, lyricsRes, metaRes] = await Promise.all([
    db
      .from("song_sections")
      .select("id, label, kind, position, updated_at")
      .eq("song_id", songId)
      .order("position", { ascending: true }),
    db
      .from("song_lyrics")
      .select("section_id, content, plain_text, updated_at")
      .eq("song_id", songId),
    db
      .from("chord_progressions")
      .select("id, chords, updated_at")
      .eq("song_id", songId)
      .eq("label", SHEET_META_LABEL)
      .maybeSingle(),
  ]);
  if (sectionsRes.error) throw sectionsRes.error;
  if (lyricsRes.error) throw lyricsRes.error;
  if (metaRes.error) throw metaRes.error;

  const meta = (metaRes.data?.chords ?? null) as SheetMetaV1 | null;
  const sections = (sectionsRes.data ?? []) as Array<{
    id: string;
    label: string | null;
    position: number;
    updated_at: string | null;
  }>;
  const lyrics = (lyricsRes.data ?? []) as Array<{
    section_id: string;
    content: unknown;
    updated_at: string | null;
  }>;

  let updatedAt: string | null = null;
  const bump = (t?: string | null) => {
    if (t && (!updatedAt || new Date(t) > new Date(updatedAt))) updatedAt = t;
  };
  sections.forEach((s) => bump(s.updated_at));
  lyrics.forEach((l) => bump(l.updated_at));
  bump(metaRes.data?.updated_at ?? null);

  if (sections.length === 0) return { doc: null, updatedAt };

  const lyricsBySection = new Map(lyrics.map((row) => [row.section_id, decodeContent(row.content)]));

  const doc: SheetDoc = {
    ...createDoc({
      songId,
      key: meta?.key ?? "C",
      mode: meta?.mode ?? "major",
      bpm: meta?.bpm,
      display: meta?.display ?? "letters",
    }),
    originalKey: meta?.originalKey ?? meta?.key ?? "C",
    capo: meta?.capo ?? 0,
    sections: sections.map(
      (s): SheetSectionDoc => ({
        id: s.id,
        label: s.label ?? "",
        lines: lyricsBySection.get(s.id) ?? [],
      }),
    ),
  };
  return { doc, updatedAt };
}

// ─── Write ───────────────────────────────────────────────────────────────────

/** Map a section label to the DB's section_kind enum. Best-effort; "other" is fine. */
function kindForLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("pre-chorus") || l.includes("pre chorus")) return "pre_chorus";
  if (l.includes("chorus")) return "chorus";
  if (l.includes("verse")) return "verse";
  if (l.includes("bridge")) return "bridge";
  if (l.includes("intro")) return "intro";
  if (l.includes("outro")) return "outro";
  if (l.includes("hook")) return "hook";
  if (l.includes("tag")) return "tag";
  return "other";
}

function sectionSignature(s: SheetSectionDoc, position: number): string {
  return JSON.stringify({ label: s.label, position, lines: s.lines });
}

/**
 * Persist the doc. Idempotent upserts, section-scoped: pass `prev` (the last
 * doc known saved) to skip sections whose content hasn't changed. Sections no
 * longer in the doc are removed (their history lives in the emitted events).
 * Returns the timestamp to use as the new reconcile baseline.
 */
export async function saveSongSheet(
  songId: string,
  doc: SheetDoc,
  prev?: SheetDoc | null,
): Promise<{ savedAt: string }> {
  const uid = await requireUserId();
  const now = new Date().toISOString();

  const prevById = new Map((prev?.sections ?? []).map((s, i) => [s.id, sectionSignature(s, i)]));
  const changed = doc.sections
    .map((s, i) => ({ section: s, position: i }))
    .filter(({ section, position }) => prevById.get(section.id) !== sectionSignature(section, position));

  if (changed.length > 0) {
    const { error: secErr } = await db.from("song_sections").upsert(
      changed.map(({ section, position }) => ({
        id: section.id,
        song_id: songId,
        label: section.label || null,
        kind: kindForLabel(section.label),
        position,
        created_by_user_id: uid,
        updated_at: now,
      })),
      { onConflict: "id" },
    );
    if (secErr) throw secErr;

    const { error: lyrErr } = await db.from("song_lyrics").upsert(
      changed.map(({ section }) => ({
        song_id: songId,
        section_id: section.id,
        content: encodeContent(section.lines),
        plain_text: plainText(section.lines),
        updated_by_user_id: uid,
        updated_at: now,
      })),
      { onConflict: "section_id" },
    );
    if (lyrErr) throw lyrErr;
  }

  // Remove sections that left the doc (soft in product terms: the emitted
  // section_removed event is the archive; version history reconstructs it).
  const keptIds = new Set(doc.sections.map((s) => s.id));
  const removedIds = (prev?.sections ?? []).map((s) => s.id).filter((id) => !keptIds.has(id));
  if (removedIds.length > 0) {
    await db.from("song_lyrics").delete().eq("song_id", songId).in("section_id", removedIds);
    const { error: delErr } = await db
      .from("song_sections")
      .delete()
      .eq("song_id", songId)
      .in("id", removedIds);
    if (delErr) throw delErr;
  }

  // Sheet meta — one song-level progression row, updated in place.
  const meta: SheetMetaV1 = {
    v: 1,
    key: doc.key,
    mode: doc.mode,
    originalKey: doc.originalKey,
    capo: doc.capo,
    bpm: doc.bpm,
    display: doc.display,
  };
  const { data: metaRow, error: metaSelErr } = await db
    .from("chord_progressions")
    .select("id")
    .eq("song_id", songId)
    .eq("label", SHEET_META_LABEL)
    .maybeSingle();
  if (metaSelErr) throw metaSelErr;
  if (metaRow?.id) {
    const { error } = await db
      .from("chord_progressions")
      .update({ chords: meta, updated_at: now })
      .eq("id", metaRow.id);
    if (error) throw error;
  } else {
    const { error } = await db.from("chord_progressions").insert({
      song_id: songId,
      label: SHEET_META_LABEL,
      section_id: null,
      chords: meta,
      created_by_user_id: uid,
    });
    if (error) throw error;
  }

  return { savedAt: now };
}

// ─── Seed from captured content (the C2 → C3 handoff) ───────────────────────

type ServerTranscriptBlock = {
  id: string;
  kind: "lyrics" | "chords" | "scripture" | "idea" | "section";
  section_kind: string | null;
  label: string;
  text: string;
};

const KIND_TITLES: Record<string, string> = {
  intro: "Intro",
  verse: "Verse",
  "pre-chorus": "Pre-Chorus",
  pre_chorus: "Pre-Chorus",
  chorus: "Chorus",
  bridge: "Bridge",
  tag: "Tag",
  outro: "Outro",
  interlude: "Interlude",
  hook: "Hook",
};

/** Split a transcript block's prose into singable lines, gently. */
function splitIntoLines(text: string): string[] {
  const byBreaks = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lines: string[] = [];
  for (const chunk of byBreaks) {
    if (chunk.length <= 64) {
      lines.push(chunk);
      continue;
    }
    // Long run-on transcript: break at sentence punctuation, then commas.
    const parts = chunk.split(/(?<=[.!?])\s+/).flatMap((p) =>
      p.length > 64 ? p.split(/(?<=,)\s+/) : [p],
    );
    lines.push(...parts.map((p) => p.trim()).filter(Boolean));
  }
  return lines;
}

/**
 * Build a first SheetDoc from the song's committed capture transcripts.
 * Reads (never rebuilds) the take pipeline's blocks. Seeded lines carry no
 * chords — the writer owns chord placement. Returns null when the song has
 * no usable captured words. Resilient to messy/partial markers by design.
 */
export async function seedSheetFromCapture(songId: string, key = "C"): Promise<SheetDoc | null> {
  const { data, error } = await db
    .from("takes")
    .select("transcript_json, created_at")
    .eq("song_id", songId)
    .eq("transcript_status", "ready")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const ordinals = new Map<string, number>();
  const sections: SheetSectionDoc[] = [];

  for (const row of (data ?? []) as Array<{ transcript_json: { blocks?: ServerTranscriptBlock[] } | null }>) {
    const blocks = row.transcript_json?.blocks ?? [];
    for (const block of blocks) {
      if (block.kind !== "lyrics" && block.kind !== "section") continue;
      const text = (block.text ?? "").trim();
      if (!text) continue;

      const kind = (block.section_kind ?? "unlabeled").toLowerCase();
      let label = (block.label ?? "").trim();
      if (!label) {
        const title = KIND_TITLES[kind];
        if (title) {
          const n = (ordinals.get(kind) ?? 0) + 1;
          ordinals.set(kind, n);
          label = kind === "chorus" || kind === "bridge" ? title : `${title} ${n}`;
        } else {
          label = "Idea";
        }
      }

      sections.push({
        id: newSheetId(),
        label,
        lines: splitIntoLines(text).map((t) => ({ id: newSheetId(), text: t, anchors: [] })),
      });
    }
  }

  if (sections.length === 0) return null;
  return { ...createDoc({ songId, key }), sections };
}

// ─── Event envelope + forwarding (docs/contracts/lyric-sheet-events.md) ─────

export type SheetEventType = SheetEventDraft["type"];

export interface SheetEvent<T = unknown> {
  id: string; // idempotency key — reused verbatim on retry
  songId: string;
  lane: "sheet";
  type: SheetEventType;
  actorId: string;
  actorRole: "owner" | "contributor" | "reviewer" | "viewer";
  entity: { type: "section" | "line" | "chord" | "song"; id: string; sectionLabel?: string };
  at: string;
  payload: T;
}

type SheetEventSink = (event: SheetEvent) => void | Promise<void>;

// The Collaboration lane (D3/E) registers the real sink (feed/versions/credits
// ingestion — transport is its call per the contract's open item #1). Until it
// does, events are buffered here and also dispatched as a window CustomEvent
// ("cog:sheet-event") so nothing is lost and nothing extra is built in C3.
let sink: SheetEventSink | null = null;
const buffered: SheetEvent[] = [];

export function registerSheetEventSink(fn: SheetEventSink): void {
  sink = fn;
  while (buffered.length > 0) {
    const e = buffered.shift();
    if (e) void fn(e);
  }
}

/** Pending events not yet consumed by a registered sink (read-only view). */
export function getBufferedSheetEvents(): readonly SheetEvent[] {
  return buffered;
}

const roleCache = new Map<string, SheetEvent["actorRole"]>();

async function resolveActorRole(songId: string, userId: string): Promise<SheetEvent["actorRole"]> {
  const cacheKey = `${songId}:${userId}`;
  const hit = roleCache.get(cacheKey);
  if (hit) return hit;
  try {
    const { data } = await db
      .from("song_members")
      .select("role")
      .eq("song_id", songId)
      .eq("user_id", userId)
      .maybeSingle();
    const role: SheetEvent["actorRole"] =
      data?.role === "owner" ? "owner" : data?.role === "viewer" ? "viewer" : "contributor";
    roleCache.set(cacheKey, role);
    return role;
  } catch {
    return "contributor";
  }
}

/**
 * Wrap a sheetState draft in the contract envelope and forward it. Fire and
 * forget from the editor's perspective — emission must never block typing.
 */
export async function emitSheetEvent(songId: string, draft: SheetEventDraft): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const actorId = data.user?.id ?? "anonymous";
    const event: SheetEvent = {
      id: newSheetId(),
      songId,
      lane: "sheet",
      type: draft.type,
      actorId,
      actorRole: await resolveActorRole(songId, actorId),
      entity: draft.entity,
      at: new Date().toISOString(),
      payload: draft.payload,
    };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cog:sheet-event", { detail: event }));
    }
    if (sink) await sink(event);
    else buffered.push(event);
  } catch {
    /* never let event plumbing break the editor */
  }
}
