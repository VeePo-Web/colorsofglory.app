import { supabase } from "@/integrations/supabase/client";
import { CogError, toCogError } from "./errors";
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
const db = supabase as unknown as {
  from: (t: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
};

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new CogError("UNAUTHENTICATED", "Not authenticated");
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
  // R19: one round trip instead of three.
  const { data, error } = await db.rpc("song_sheet_bootstrap", { _song_id: songId });
  if (error) throw toCogError(error);
  const payload = (data ?? {}) as {
    sections?: Array<{
      id: string;
      label: string | null;
      position: number;
      content: unknown;
    }>;
    meta?: SheetMetaV1 | null;
    updated_at?: string | null;
  };

  const meta = (payload.meta ?? null) as SheetMetaV1 | null;
  const sections = payload.sections ?? [];
  const updatedAt = payload.updated_at ?? null;

  if (sections.length === 0) return { doc: null, updatedAt };

  const lyricsBySection = new Map(sections.map((row) => [row.id, decodeContent(row.content)]));

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
  const prevById = new Map((prev?.sections ?? []).map((s, i) => [s.id, sectionSignature(s, i)]));
  const changed = doc.sections
    .map((s, i) => ({ section: s, position: i }))
    .filter(({ section, position }) => prevById.get(section.id) !== sectionSignature(section, position));

  const keptIds = new Set(doc.sections.map((s) => s.id));
  const removedIds = (prev?.sections ?? []).map((s) => s.id).filter((id) => !keptIds.has(id));

  const meta: SheetMetaV1 = {
    v: 1,
    key: doc.key,
    mode: doc.mode,
    originalKey: doc.originalKey,
    capo: doc.capo,
    bpm: doc.bpm,
    display: doc.display,
  };
  // R19: one atomic RPC — sections, lyrics, removals and meta all-or-nothing.
  const { data, error } = await db.rpc("save_song_sheet", {
    _song_id: songId,
    _sections: changed.map(({ section, position }) => ({
      id: section.id,
      label: section.label || null,
      kind: kindForLabel(section.label),
      position,
      content: encodeContent(section.lines),
      plain_text: plainText(section.lines),
    })),
    _removed_ids: removedIds,
    _meta: meta,
  });
  if (error) throw toCogError(error);

  return { savedAt: (data?.saved_at as string) ?? new Date().toISOString() };
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
  if (error) throw toCogError(error);

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

// ─── R13: conflict-safe section saving ───────────────────────────────────────

/**
 * Per-section revision stamps. Cheap enough to poll or refetch on focus —
 * compare `updated_at` against the stamp you last saved with to know a section
 * went stale under the editor before the person hits save.
 */
export type SectionHead = {
  section_id: string;
  label: string | null;
  section_position: number;
  updated_at: string | null;
  updated_by_user_id: string | null;
};

export async function getSectionHeads(songId: string): Promise<SectionHead[]> {
  const { data, error } = await (supabase as any).rpc("song_lyrics_heads", { _song_id: songId });
  if (error) throw toCogError(error);
  return (data ?? []) as SectionHead[];
}

export type GuardedSaveResult =
  | { status: "saved"; section_id: string; updated_at: string; updated_by_user_id: string }
  | {
      status: "conflict";
      section_id: string;
      updated_at: string;
      updated_by_user_id: string | null;
      /** Their current version, decoded — render side-by-side, never auto-merge. */
      serverLines: SheetLineDoc[];
      server_plain_text: string | null;
    };

/**
 * Save ONE section's lines without ever silently clobbering a collaborator.
 *
 * Pass `expectedUpdatedAt` — the `updated_at` you last read/saved for that
 * section. If someone else saved a newer version in the meantime, nothing is
 * written and you get `status: "conflict"` plus their text. Show both versions
 * and let the person choose ("Keep mine" re-saves with their newer stamp);
 * do not auto-merge and do not drop the local draft.
 */
export async function saveSectionGuarded(
  songId: string,
  section: SheetSectionDoc,
  opts: { expectedUpdatedAt?: string | null; position?: number } = {},
): Promise<GuardedSaveResult> {
  const { data, error } = await (supabase as any).rpc("save_section_lyrics_guarded", {
    _song_id: songId,
    _section_id: section.id,
    _content: encodeContent(section.lines),
    _plain_text: plainText(section.lines),
    _expected_updated_at: opts.expectedUpdatedAt ?? null,
    _label: section.label || null,
    _position: opts.position ?? null,
  });
  if (error) throw toCogError(error);
  const res = data as any;
  if (res?.status === "conflict") {
    return {
      status: "conflict",
      section_id: res.section_id,
      updated_at: res.updated_at,
      updated_by_user_id: res.updated_by_user_id ?? null,
      serverLines: decodeContent(res.server_content),
      server_plain_text: res.server_plain_text ?? null,
    };
  }
  return res as GuardedSaveResult;
}

// ─── R15: arrangement (order & duplicate) ────────────────────────────────────

export type ReorderResult =
  | { status: "saved"; ordered_ids: string[]; updated_at: string }
  /** Someone added or removed a section since you started dragging. Refetch, then retry. */
  | { status: "stale"; current_ids: string[] };

/**
 * Save a new section order in ONE atomic step. Send the complete list of
 * section ids in their new order — the server refuses (`stale`) if that list no
 * longer matches the song, so a late drag can never scramble or drop a section.
 * Never write positions through `saveSongSheet` for reordering.
 */
export async function reorderSections(songId: string, orderedIds: string[]): Promise<ReorderResult> {
  const { data, error } = await (supabase as any).rpc("reorder_song_sections", {
    _song_id: songId,
    _ordered_ids: orderedIds,
  });
  if (error) throw toCogError(error);
  return data as ReorderResult;
}

/**
 * Duplicate a section (label + lyrics + chord anchors) directly after itself —
 * the "second chorus" move. Returns the new section id and its position.
 */
export async function duplicateSection(
  songId: string,
  sectionId: string,
  label?: string,
): Promise<{ status: "created"; section_id: string; position: number; updated_at: string }> {
  const { data, error } = await (supabase as any).rpc("duplicate_song_section", {
    _song_id: songId,
    _section_id: sectionId,
    _label: label ?? null,
  });
  if (error) throw toCogError(error);
  return data as { status: "created"; section_id: string; position: number; updated_at: string };
}

// ─── R55: line-level merge — never show a conflict screen ────────────────────

export type MergedSaveResult = {
  status: "saved";
  section_id: string;
  updated_at: string;
  /** The authoritative merged lines. Replace local state with these. */
  lines: SheetLineDoc[];
  plain_text: string;
  /** How many of my lines landed as-is. */
  merged_lines: number;
  /** Lines where we both typed: theirs stayed, mine became a suggestion. */
  kept_theirs: number;
  suggestions_created: number;
};

/**
 * Save one section by MERGING, not by blocking.
 *
 * Pass `baseLines` — exactly the lines this editor last received from the
 * server (its snapshot before the person started typing). The server then:
 *   • keeps every line only one of you touched (both edits survive, silently),
 *   • keeps their line when you both edited the SAME line, and files your
 *     version as an inline `lyric_suggestion` on that line id,
 *   • keeps lines either of you added while the other was typing.
 *
 * There is no `conflict` status and no dialog. Replace local lines with
 * `result.lines`. If `kept_theirs > 0`, show one quiet inline line on those
 * rows ("your version is waiting here") — never a modal, never a toast stack.
 *
 * Prefer this over `saveSectionGuarded` for all typing in the room; the
 * guarded save remains only for imports/replacements that must not merge.
 */
export async function saveSectionMerged(
  songId: string,
  section: SheetSectionDoc,
  baseLines: SheetLineDoc[],
  opts: { position?: number } = {},
): Promise<MergedSaveResult> {
  const { data, error } = await (supabase as any).rpc("save_section_lyrics_merged", {
    _song_id: songId,
    _section_id: section.id,
    _base: encodeContent(baseLines),
    _content: encodeContent(section.lines),
    _plain_text: plainText(section.lines),
    _label: section.label || null,
    _position: opts.position ?? null,
  });
  if (error) throw toCogError(error);
  const res = data as any;
  return {
    status: "saved",
    section_id: res.section_id,
    updated_at: res.updated_at,
    lines: decodeContent(res.content),
    plain_text: res.plain_text ?? "",
    merged_lines: res.merged_lines ?? 0,
    kept_theirs: res.kept_theirs ?? 0,
    suggestions_created: res.suggestions_created ?? 0,
  };
}
