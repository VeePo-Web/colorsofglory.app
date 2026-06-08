import { supabase } from "@/integrations/supabase/client";

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
  const { data, error } = await db
    .from("takes")
    .select("id, song_id, storage_path, duration_ms, transcript_status, transcript_json, transcript_error")
    .eq("id", take_id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown) as TakeTranscriptRow | null;
}