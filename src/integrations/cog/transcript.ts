import { supabase } from "@/integrations/supabase/client";

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
