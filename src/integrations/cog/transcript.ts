import { supabase } from "@/integrations/supabase/client";

export type TranscriptBlock = {
  id: string;
  kind: "lyrics" | "chords" | "scripture" | "idea" | "section";
  section_kind: string | null;
  label: string;
  text: string;
  start_ms: number;
  end_ms: number;
};

export type TranscriptPayload = {
  model: string;
  blocks: TranscriptBlock[];
  raw_text: string;
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
  const { data, error } = await supabase.functions.invoke("transcribe-take", {
    body: { take_id },
  });
  if (error) throw error;
  return ((data as { blocks?: TranscriptBlock[] })?.blocks ?? []) as TranscriptBlock[];
}

export async function getTakeWithTranscript(take_id: string): Promise<TakeTranscriptRow | null> {
  const { data, error } = await supabase
    .from("takes")
    .select("id, song_id, storage_path, duration_ms, transcript_status, transcript_json, transcript_error")
    .eq("id", take_id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown) as TakeTranscriptRow | null;
}

/**
 * Look up the primary take id for a freshly-created voice memo.
 * `intake-voice-memo` always inserts one take row (is_primary=true) per memo.
 */
export async function getPrimaryTakeIdForMemo(voice_memo_id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("takes")
    .select("id")
    .eq("voice_memo_id", voice_memo_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
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
