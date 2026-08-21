import { supabase } from "@/integrations/supabase/client";
import type {
  PracticeSection,
  PracticeTake,
  PracticeLayer,
  PracticeChordLine,
  TranscriptLine,
} from "@/lib/audio/practiceTypes";
import { loadHistory } from "@/lib/audio/practiceStorage";
import { masteryFromLoops } from "@/lib/audio/practiceTypes";
import { getSongSheet } from "@/integrations/cog/sheet";
import type { SheetDoc } from "@/lib/chords/sheetState";
import { chordToLetters, chordToNumbers } from "@/lib/chords/nashville";
import { groupIntoStacks } from "@/lib/voice/stackModel";

interface SectionRow {
  id: string;
  label: string | null;
  position: number | null;
}

/** A voice_memos row as practice reads it — exported for the pure grouping tests. */
export interface PracticeMemoRow {
  id: string;
  section_id: string | null;
  duration_ms: number | null;
  title: string | null;
  created_at?: string | null;
  /** Stack link: the base this memo was sung over. null/absent ⇒ a base. */
  parent_memo_id?: string | null;
  /** Room-shared mix persisted by the stack sheet. */
  layer_gain?: number | null;
  layer_muted?: boolean | null;
  layer_offset_ms?: number | null;
  author_user_id?: string | null;
}

export interface PracticeTranscriptRow {
  memo_id: string;
  text: string;
  segments: unknown;
}

interface WordTimestamp {
  word: string;
  start: number; // seconds
  end: number;
}

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

function isWordTimestamp(value: unknown): value is WordTimestamp {
  const item = value as Partial<WordTimestamp>;
  return (
    Boolean(item) &&
    typeof item.word === "string" &&
    typeof item.start === "number" &&
    typeof item.end === "number"
  );
}

function isTranscriptSegment(value: unknown): value is TranscriptSegment {
  const item = value as Partial<TranscriptSegment>;
  return (
    Boolean(item) &&
    typeof item.text === "string" &&
    typeof item.start === "number" &&
    typeof item.end === "number"
  );
}

/**
 * Parses Whisper word-level timestamps into per-line transcript lines.
 * Groups words into lines of max MAX_WORDS_PER_LINE words.
 */
function parseWordTimestamps(raw: unknown): TranscriptLine[] | null {
  if (!raw || !Array.isArray(raw)) return null;
  if (raw.length === 0) return null;
  if (raw.every(isTranscriptSegment)) {
    return raw.map((segment) => ({
      text: segment.text.trim(),
      startMs: Math.round(segment.start * 1000),
      endMs: Math.round(segment.end * 1000),
    })).filter((line) => line.text.length > 0);
  }
  if (!raw.every(isWordTimestamp)) return null;

  const words = raw;
  if (words.length === 0) return null;

  const MAX_WORDS = 8;
  const lines: TranscriptLine[] = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + MAX_WORDS);
    const text = chunk.map(w => w.word).join(" ").trim();
    const startMs = Math.round(chunk[0].start * 1000);
    const endMs   = Math.round(chunk[chunk.length - 1].end * 1000);
    lines.push({ text, startMs, endMs });
    i += MAX_WORDS;
  }

  return lines;
}

// ─── Chords from C3's sheet (read-only) ─────────────────────────────────────

/** Normalize a section label for sheet↔practice matching ("Verse 1 " ≡ "verse 1"). */
export function normalizeSectionLabel(label: string | null | undefined): string {
  return (label ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Pre-render a SheetDoc's sections into practice chord lines, keyed by
 * normalized label. Chords render in the doc's display key/mode/notation —
 * exactly what the writer sees in the sheet editor. First section with a
 * given label wins (a repeated "Chorus" maps to the one chart). Pure;
 * exported for tests.
 */
export function buildChordLinesByLabel(doc: SheetDoc): Map<string, PracticeChordLine[]> {
  const byLabel = new Map<string, PracticeChordLine[]>();
  for (const section of doc.sections) {
    const key = normalizeSectionLabel(section.label);
    if (!key || byLabel.has(key)) continue;
    const lines: PracticeChordLine[] = section.lines
      .filter((l) => l.text.trim().length > 0 || l.anchors.length > 0)
      .map((l) => ({
        text: l.text,
        chords: l.anchors.map((a) => ({
          glyph:
            doc.display === "numbers"
              ? chordToNumbers(a.chord, doc.mode)
              : chordToLetters(a.chord, doc.key, doc.mode),
          at: a.at,
        })),
      }));
    if (lines.length > 0) byLabel.set(key, lines);
  }
  return byLabel;
}

/** The song-level practice payload: sections plus the sheet's tempo and key. */
export interface PracticeBundle {
  sections: PracticeSection[];
  /** Tempo from C3's sheet meta; null when the song has no declared tempo. */
  bpm: number | null;
  /** Display key from C3's sheet; null when there is no sheet. */
  songKey: string | null;
}

/**
 * Loads all song sections with EVERY playable voice memo per section (the
 * section's takes, F15) plus the song's lyric+chord sheet (C3, read-only) and
 * returns a ready-to-use practice payload. The sheet is best-effort — a song
 * with no sheet simply practices without chords.
 *
 * This function lives in lib/ (not pages/components) so it may use supabase directly.
 */
export async function loadPracticeBundle(songId: string): Promise<PracticeBundle> {
  const [sections, sheet] = await Promise.all([
    loadPracticeSections(songId),
    getSongSheet(songId).catch(() => null),
  ]);

  const doc = sheet?.doc ?? null;
  if (doc) {
    const chordsByLabel = buildChordLinesByLabel(doc);
    for (const section of sections) {
      section.chordLines = chordsByLabel.get(normalizeSectionLabel(section.label)) ?? null;
    }
  }

  return {
    sections,
    bpm: doc?.bpm ?? null,
    songKey: doc?.key ?? null,
  };
}

/**
 * Loads all song sections and their associated voice memos — every playable
 * memo per section becomes a take (oldest first); the first take is mirrored
 * into the section's active fields so the engine's existing paths are
 * untouched. Returns a ready-to-use PracticeSection[] for the practice player.
 *
 * This function lives in lib/ (not pages/components) so it may use supabase directly.
 */
export async function loadPracticeSections(songId: string): Promise<PracticeSection[]> {
  // 1. Load song sections
  const { data: sectionsData, error: sectionsErr } = await supabase
    .from("song_sections")
    .select("id, label, position")
    .eq("song_id", songId)
    .order("position", { ascending: true });

  if (sectionsErr) throw sectionsErr;

  // 2. Load all active voice memos for this song — WITH the stack columns.
  // parent_memo_id is the seam that makes practice hear the whole song: a
  // base + 3 harmonies used to arrive here as 4 swipeable "takes" because
  // this select was deaf to layers, so every practice surface played the
  // family one voice at a time.
  const { data: memosData, error: memosErr } = await supabase
    .from("voice_memos")
    .select(
      "id, section_id, duration_ms, title, created_at, parent_memo_id, layer_gain, layer_muted, layer_offset_ms, author_user_id",
    )
    .eq("song_id", songId)
    .in("status", ["finalized", "transcribed", "ready"])
    .order("created_at", { ascending: true });

  if (memosErr) throw memosErr;

  const memos = (memosData ?? []) as PracticeMemoRow[];
  const sections = (sectionsData ?? []) as SectionRow[];

  // Load all transcripts in one query for all memo IDs
  const memoIds = memos.map(m => m.id);
  let transcripts: PracticeTranscriptRow[] = [];
  if (memoIds.length > 0) {
    const { data: txData } = await supabase
      .from("voice_memo_transcripts")
      .select("memo_id, text, segments")
      .in("memo_id", memoIds)
      .eq("status", "ready");
    transcripts = (txData ?? []) as PracticeTranscriptRow[];
  }

  const transcriptByMemoId = new Map<string, PracticeTranscriptRow>(
    transcripts.map(t => [t.memo_id, t]),
  );

  const takesBySection = buildSectionTakes(memos, transcriptByMemoId);

  // Load persisted mastery data
  const history = loadHistory(songId);

  // 3. Build PracticeSection[] — one entry per section that has a memo.
  // The FIRST take is mirrored into the section's active fields so every
  // existing engine path (caching, playback, karaoke) is untouched.
  const result: PracticeSection[] = [];

  // Sections with known section_id
  for (const section of sections) {
    const takes = takesBySection.get(section.id);
    if (!takes || takes.length === 0) continue; // no voice memo → not practicable

    const active = takes[0];

    const sectionHistory = history.sections[section.id];
    const masteryLevel = sectionHistory
      ? masteryFromLoops(sectionHistory.loopsAtFullSpeed)
      : "untouched";

    result.push({
      id: section.id,
      label: section.label ?? `Section ${section.position ?? result.length + 1}`,
      memoId: active.memoId,
      lyrics: active.lyrics,
      transcriptLines: active.transcriptLines,
      durationMs: active.durationMs,
      cacheStatus: "pending",
      masteryLevel,
      loopCountThisSession: 0,
      takes,
      activeTakeIndex: 0,
    });
  }

  // Stacks whose BASE is not attached to any section — append at end, all of
  // them together as one "Voice Memo" section with N takes.
  const nullTakes = takesBySection.get(null) ?? [];
  if (nullTakes.length > 0 && !result.some(r => r.memoId === nullTakes[0].memoId)) {
    const active = nullTakes[0];

    result.push({
      id: `unassigned-${nullTakes[0].memoId}`,
      label: active.label || "Voice Memo",
      memoId: active.memoId,
      lyrics: active.lyrics,
      transcriptLines: active.transcriptLines,
      durationMs: active.durationMs,
      cacheStatus: "pending",
      masteryLevel: "untouched",
      loopCountThisSession: 0,
      takes: nullTakes,
      activeTakeIndex: 0,
    });
  }

  return result;
}

/**
 * PURE: flat voice_memos rows → per-section takes. Exported for tests.
 *
 * The two rules that make practice hear the song the way the room built it:
 *  1. Stacks are grouped SONG-WIDE, then a stack lives wherever its BASE
 *     lives — a layer ("Sing over this") skips the section decision at save
 *     time, so its own section_id may be null or stale; following it would
 *     tear a harmony away from its base into a phantom "take."
 *  2. Bases are the takes (F15 swipe-between-alternates); a base's layers
 *     ride WITH it, carrying the room-shared seed mix. Orphan layers (base
 *     deleted/unloaded) promote to their own base — never dropped
 *     (groupIntoStacks' covenant: a captured idea is never lost).
 */
export function buildSectionTakes(
  memos: PracticeMemoRow[],
  transcriptByMemoId: Map<string, PracticeTranscriptRow>,
): Map<string | null, PracticeTake[]> {
  const stacks = groupIntoStacks(
    memos.map((m) => ({
      ...m,
      parentMemoId: m.parent_memo_id ?? null,
      createdAt: m.created_at ?? undefined,
    })),
  );

  const layerFromMemo = (memo: PracticeMemoRow, index: number): PracticeLayer => ({
    memoId: memo.id,
    label: memo.title?.trim() || `Layer ${index + 1}`,
    durationMs: memo.duration_ms ?? 0,
    gain: typeof memo.layer_gain === "number" ? memo.layer_gain : 1,
    muted: memo.layer_muted === true,
    offsetMs:
      typeof memo.layer_offset_ms === "number" && memo.layer_offset_ms > 0
        ? memo.layer_offset_ms
        : 0,
    authorId: memo.author_user_id ?? null,
  });

  const takesBySection = new Map<string | null, PracticeTake[]>();
  for (const stack of stacks) {
    const memo = stack.base;
    const transcript = transcriptByMemoId.get(memo.id);
    const transcriptLines = transcript
      ? parseWordTimestamps(transcript.segments) ??
        (transcript.text
          ? [{ text: transcript.text, startMs: 0, endMs: memo.duration_ms ?? 0 }]
          : null)
      : null;

    const key = memo.section_id ?? null;
    const arr = takesBySection.get(key) ?? [];
    arr.push({
      memoId: memo.id,
      label: memo.title?.trim() || `Take ${arr.length + 1}`,
      durationMs: memo.duration_ms ?? 0,
      lyrics: transcript?.text || null,
      transcriptLines,
      layers: stack.layers.map(layerFromMemo),
      authorId: memo.author_user_id ?? null,
    });
    takesBySection.set(key, arr);
  }
  return takesBySection;
}

/**
 * Loads a whole album's worth of practice sections — every playable section
 * of every song in the album, flattened into one continuous list, in album
 * (tracklist) order. Each section is tagged with its song so the player can
 * show a "which song" eyebrow while looping in the car.
 *
 * Section ids are namespaced by song id so two songs that share a section id
 * (e.g. both have a "chorus" row) never collide in the player or in mastery
 * history. Songs with no playable memos are simply skipped. Loads run in
 * parallel; a song that fails to load is dropped rather than failing the album.
 */
export async function loadAlbumPracticeSections(
  songs: { id: string; title: string }[],
): Promise<PracticeSection[]> {
  const perSong = await Promise.all(
    songs.map(async (song) => {
      try {
        // Bundle (not bare sections) so album rehearsal gets each song's
        // chords too; per-song bpm is ignored — tempo is set per session.
        const { sections } = await loadPracticeBundle(song.id);
        return sections.map((s) => ({
          ...s,
          id: `${song.id}::${s.id}`,
          songId: song.id,
          songTitle: song.title,
        }));
      } catch {
        return [] as PracticeSection[];
      }
    }),
  );
  return perSong.flat();
}
