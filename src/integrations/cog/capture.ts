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

// ── Legacy quick-capture surface (idea_captures) ─────────────────────────────
// Still read by the capture inbox + optimistic mutation layer.

export type IdeaCapture = {
  id: string;
  song_id: string | null;
  author_user_id: string;
  title: string | null;
  lyric_snippet: string | null;
  scripture_ref: string | null;
  tags: string[];
  section_id: string | null;
  voice_memo_id: string | null;
  created_at: string;
  updated_at: string;
  promoted_card_id: string | null;
};

export type QuickCaptureInput = {
  song_id?: string | null;
  title?: string | null;
  lyric_snippet?: string | null;
  scripture_ref?: string | null;
  tags?: string[];
  section_id?: string | null;
  voice_memo_id?: string | null;
};

const CAPTURE_COLS =
  "id,song_id,author_user_id,title,lyric_snippet,scripture_ref,tags,section_id,voice_memo_id,created_at,updated_at,promoted_card_id";

/** Captures filed into one song, newest first. */
export async function listCaptures(songId: string): Promise<IdeaCapture[]> {
  const { data, error } = await supabase
    .from("idea_captures")
    .select(CAPTURE_COLS)
    .eq("song_id", songId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as IdeaCapture[];
}

/** The signed-in user's captures not yet filed into any song. */
export async function listMyUnfiledCaptures(): Promise<IdeaCapture[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("idea_captures")
    .select(CAPTURE_COLS)
    .is("song_id", null)
    .is("archived_at", null)
    .eq("author_user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as IdeaCapture[];
}

/** Save a quick capture. Returns the new capture id. */
export async function quickCapture(input: QuickCaptureInput): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("idea_captures")
    .insert({
      author_user_id: uid,
      song_id: input.song_id ?? null,
      title: input.title ?? null,
      lyric_snippet: input.lyric_snippet ?? null,
      scripture_ref: input.scripture_ref ?? null,
      tags: input.tags ?? [],
      section_id: input.section_id ?? null,
      voice_memo_id: input.voice_memo_id ?? null,
      client_key: newClientKey(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}
