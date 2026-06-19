import { supabase } from "@/integrations/supabase/client";

export type QuickCaptureInput = {
  song_id?: string | null;
  title?: string;
  lyric_snippet?: string;
  scripture_ref?: string;
  tags?: string[];
  section_id?: string | null;
  voice_memo_id?: string | null;
};

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
  promoted_card_id?: string | null;
};

/** Atomically save a quick-capture entry; bumps song last_activity_at when scoped to a song. */
export async function quickCapture(input: QuickCaptureInput): Promise<string> {
  const { data, error } = await supabase.rpc("quick_capture", {
    _song_id: input.song_id ?? null,
    _title: input.title ?? "",
    _lyric_snippet: input.lyric_snippet ?? "",
    _scripture_ref: input.scripture_ref ?? "",
    _tags: input.tags ?? [],
    _section_id: input.section_id ?? null,
    _voice_memo_id: input.voice_memo_id ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function listCaptures(song_id: string): Promise<IdeaCapture[]> {
  const { data, error } = await supabase
    .from("idea_captures")
    .select("*")
    .eq("song_id", song_id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as IdeaCapture[];
}

export async function listMyUnfiledCaptures(): Promise<IdeaCapture[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("idea_captures")
    .select("*")
    .is("song_id", null)
    .eq("author_user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as IdeaCapture[];
}

export async function deleteCapture(id: string): Promise<void> {
  const { error } = await supabase.from("idea_captures").delete().eq("id", id);
  if (error) throw error;
}

export type PromoteCaptureInput = {
  capture_id: string;
  target_song_id?: string;
  target_tree?: "ideas" | "final";
  section_label?: string;
  x?: number;
  y?: number;
};

export type PromoteCaptureResult = {
  card_id: string;
  take_id: string | null;
  transcript_pending: boolean;
  already_promoted: boolean;
};

/** Promote an idea capture into a canvas card (idempotent per capture). */
export async function promoteCapture(input: PromoteCaptureInput): Promise<PromoteCaptureResult> {
  const { data, error } = await supabase.functions.invoke<PromoteCaptureResult>("promote-capture", {
    body: input,
  });
  if (error) throw error;
  if (!data) throw new Error("promote-capture returned no data");
  return data;
}