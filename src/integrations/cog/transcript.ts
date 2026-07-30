import { supabase } from "@/integrations/supabase/client";
import { call, toCogError } from "./errors";

// Cast for new columns not yet in generated Database types.
const db = supabase as unknown as { from: (t: string) => any };

export type TranscriptBlock = {
  id: string;
  kind: "lyrics" | "chords" | "scripture" | "idea" | "section";
  section_kind: string | null;
  label: string;
  text: string;
  start_ms: number;
  end_ms: number;
  /**
   * 0..1 segmentation confidence from the server pass (regex 1.0; LLM-repaired
   * boundaries may be lower). Optional + additive — older payloads lack it.
   * See docs/TRANSCRIPTION-CONTRACT.md.
   */
  confidence?: number;
};

export type TranscriptPayload = {
  model: string;
  blocks: TranscriptBlock[];
  raw_text: string;
  /**
   * Whisper word-level timing (optional + additive). Powers per-section audio
   * clipping for takes reopened after this session's live words are gone.
   * Contract: docs/TRANSCRIPTION-CONTRACT.md (Lovable ask: docs/prompts/L12).
   */
  words?: { text: string; start_ms: number; end_ms: number }[];
  /** Which pass produced `blocks` — additive metadata for observability. */
  segmentation?: "regex" | "llm" | "llm_fallback_regex";
};

export type TranscriptStatus = "idle" | "processing" | "ready" | "failed";

export type TakeTranscriptRow = {
  id: string;
  song_id: string;
  storage_path: string;
  duration_ms: number | null;
  transcript_status: TranscriptStatus;
  transcript_json: TranscriptPayload | null;
  transcript_error: string | null;
};

/** Kick off transcription. Resolves with the structured blocks. */
export async function requestTranscript(take_id: string): Promise<TranscriptBlock[]> {
  const data = await call<{ blocks?: TranscriptBlock[] }>("transcribe-take", { take_id });
  return (data?.blocks ?? []) as TranscriptBlock[];
}

export async function getTakeWithTranscript(take_id: string): Promise<TakeTranscriptRow | null> {
  const { data, error } = await db
    .from("takes")
    .select("id, song_id, storage_path, duration_ms, transcript_status, transcript_json, transcript_error")
    .eq("id", take_id)
    .maybeSingle();
  if (error) throw toCogError(error);
  return (data as unknown) as TakeTranscriptRow | null;
}

/**
 * Look up the primary take id for a freshly-created voice memo.
 * `intake-voice-memo` always inserts one take row (is_primary=true) per memo.
 */
export async function getPrimaryTakeIdForMemo(voice_memo_id: string): Promise<string | null> {
  const { data, error } = await db
    .from("takes")
    .select("id")
    .eq("voice_memo_id", voice_memo_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw toCogError(error);
  return (data?.id as string | undefined) ?? null;
}

/**
 * Poll `getTakeWithTranscript` until the transcript reaches a terminal status.
 * Resolves once status is "ready" or "failed", or when the timeout elapses.
 */
export async function pollTranscriptUntilReady(
  take_id: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<TakeTranscriptRow | null> {
  const intervalMs = opts.intervalMs ?? 1200;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const row = await getTakeWithTranscript(take_id);
    if (!row) return null;
    if (row.transcript_status === "ready" || row.transcript_status === "failed") return row;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return await getTakeWithTranscript(take_id);

}

// ── R30 — transcript → lyric lines ──────────────────────────────────────────

export type TranscriptLine = {
  ord: number;
  text: string;
  start_ms: number | null;
  end_ms: number | null;
};

export type TranscriptLines = {
  take_id: string;
  song_id: string;
  status: "pending" | "processing" | "ready" | "failed" | "skipped" | string;
  lines: TranscriptLine[];
};

/** The words heard in a take, already split into suggested lyric lines. */
export async function fetchTranscriptLines(takeId: string): Promise<TranscriptLines> {
  const { data, error } = await supabase.rpc("take_transcript_lines", {
    _take_id: takeId,
  } as never);
  if (error) {
    if (error.message.includes("take_not_found")) throw new Error("That take is gone.");
    throw new Error("Couldn't read that recording's words.");
  }
  return data as unknown as TranscriptLines;
}

/** Drop the reviewed lines into a section. */
export async function applyTranscriptToSection(args: {
  sectionId: string;
  lines: string[];
  mode?: "append" | "replace";
}): Promise<{ section_id: string; added: number; total: number }> {
  const { data, error } = await supabase.rpc("apply_transcript_to_section", {
    _section_id: args.sectionId,
    _lines: args.lines,
    _mode: args.mode ?? "append",
  } as never);
  if (error) {
    if (error.message.includes("no_lines")) throw new Error("Pick at least one line.");
    if (error.message.includes("section_not_found")) throw new Error("That section is gone.");
    if (error.message.includes("forbidden"))
      throw new Error("You don't have edit access to this song.");
    throw new Error("Couldn't add those lines. Try again.");
  }
  return data as unknown as { section_id: string; added: number; total: number };
}

export function transcriptIsReady(t: TranscriptLines): boolean {
  return t.status === "ready" && t.lines.length > 0;
}
