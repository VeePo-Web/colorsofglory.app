import { supabase } from "@/integrations/supabase/client";

/**
 * R61 — One capture, one button.
 *
 * Tap = type. Hold = hum. Both go through here, both land somewhere
 * real, and both tell you where they landed so the UI can scroll to it.
 */

export type CaptureResult =
  | { kind: "line"; line_id: string; section_id: string }
  | { kind: "card"; card_id: string; section_id: string | null };

export function newClientKey(): string {
  return crypto.randomUUID();
}

/**
 * @param sectionId the part currently in view, if any. Typed text with a
 *        section in view becomes the next lyric line in that part.
 *        Everything else lands at the top of the ideas shelf.
 */
export async function captureIdea(args: {
  songId: string;
  clientKey?: string;
  body?: string;
  sectionId?: string | null;
  takeId?: string | null;
}): Promise<CaptureResult> {
  const { data, error } = await supabase.rpc("capture_idea", {
    _song_id: args.songId,
    _client_key: args.clientKey ?? newClientKey(),
    _body: args.body ?? null,
    _section_id: args.sectionId ?? null,
    _take_id: args.takeId ?? null,
  });
  if (error) throw error;
  return data as unknown as CaptureResult;
}

/** Where the capture should scroll to, in R59 room-hash form. */
export function captureAnchor(result: CaptureResult): string {
  return result.kind === "line" ? `#s-${result.section_id}` : `#c-${result.card_id}`;
}
