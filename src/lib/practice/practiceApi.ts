import { supabase } from "@/integrations/supabase/client";
import type { PracticeSection, TranscriptLine } from "@/lib/audio/practiceTypes";
import { loadHistory } from "@/lib/audio/practiceStorage";
import { masteryFromLoops } from "@/lib/audio/practiceTypes";

interface SectionRow {
  id: string;
  label: string | null;
  position: number | null;
}

interface MemoRow {
  id: string;
  section_id: string | null;
  duration_ms: number | null;
  title: string | null;
}

interface TranscriptRow {
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

/**
 * Loads all song sections and their associated voice memos (first memo per section)
 * and returns a ready-to-use PracticeSection[] for the practice player.
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

  // 2. Load all active voice memos for this song
  const { data: memosData, error: memosErr } = await supabase
    .from("voice_memos")
    .select("id, section_id, duration_ms, title")
    .eq("song_id", songId)
    .in("status", ["finalized", "transcribed", "ready"])
    .order("created_at", { ascending: true });

  if (memosErr) throw memosErr;

  const memos = (memosData ?? []) as MemoRow[];
  const sections = (sectionsData ?? []) as SectionRow[];

  // Load all transcripts in one query for all memo IDs
  const memoIds = memos.map(m => m.id);
  let transcripts: TranscriptRow[] = [];
  if (memoIds.length > 0) {
    const { data: txData } = await supabase
      .from("voice_memo_transcripts")
      .select("memo_id, text, segments")
      .in("memo_id", memoIds)
      .eq("status", "ready");
    transcripts = (txData ?? []) as TranscriptRow[];
  }

  const transcriptByMemoId = new Map<string, TranscriptRow>(
    transcripts.map(t => [t.memo_id, t]),
  );

  // Build a memo-per-section map: section_id → first memo
  const memoBySection = new Map<string | null, MemoRow>();
  for (const memo of memos) {
    const key = memo.section_id ?? null;
    if (!memoBySection.has(key)) {
      memoBySection.set(key, memo);
    }
  }

  // Load persisted mastery data
  const history = loadHistory(songId);

  // 3. Build PracticeSection[] — one entry per section that has a memo
  const result: PracticeSection[] = [];

  // Sections with known section_id
  for (const section of sections) {
    const memo = memoBySection.get(section.id);
    if (!memo) continue; // skip sections with no voice memo

    const transcript = memo ? transcriptByMemoId.get(memo.id) : undefined;
    const transcriptLines = transcript
      ? parseWordTimestamps(transcript.segments) ??
        (transcript.text
          ? [{ text: transcript.text, startMs: 0, endMs: memo.duration_ms ?? 0 }]
          : null)
      : null;

    const sectionHistory = history.sections[section.id];
    const masteryLevel = sectionHistory
      ? masteryFromLoops(sectionHistory.loopsAtFullSpeed)
      : "untouched";

    result.push({
      id: section.id,
      label: section.label ?? `Section ${section.position ?? result.length + 1}`,
      memoId: memo?.id ?? null,
      lyrics: transcript?.text || null,
      transcriptLines,
      durationMs: memo?.duration_ms ?? 0,
      cacheStatus: "pending",
      masteryLevel,
      loopCountThisSession: 0,
    });
  }

  // Memos not attached to any section (section_id = null) — append at end
  const nullMemo = memoBySection.get(null);
  if (nullMemo && !result.some(r => r.memoId === nullMemo.id)) {
    const transcript = transcriptByMemoId.get(nullMemo.id);
    const transcriptLines = transcript
      ? parseWordTimestamps(transcript.segments) ??
        (transcript.text
          ? [{ text: transcript.text, startMs: 0, endMs: nullMemo.duration_ms ?? 0 }]
          : null)
      : null;

    result.push({
      id: `unassigned-${nullMemo.id}`,
      label: nullMemo.title ?? "Voice Memo",
      memoId: nullMemo.id,
      lyrics: transcript?.text || null,
      transcriptLines,
      durationMs: nullMemo.duration_ms ?? 0,
      cacheStatus: "pending",
      masteryLevel: "untouched",
      loopCountThisSession: 0,
    });
  }

  return result;
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
        const sections = await loadPracticeSections(song.id);
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
