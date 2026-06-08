import { supabase } from "@/integrations/supabase/client";
import { uploadVoiceMemo, getPlaybackUrl, type VoiceMemo } from "./memos";

export type BrainstormMemo = VoiceMemo & { notes: string | null };

export async function listBrainstormMemos(songId: string, includeArchived = false): Promise<BrainstormMemo[]> {
  let q = supabase
    .from("voice_memos")
    .select("*")
    .eq("song_id", songId)
    .order("created_at", { ascending: false });
  if (!includeArchived) q = q.neq("status", "archived" as never).neq("status", "deleted");
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as BrainstormMemo[];
}

export async function updateMemoTitle(memoId: string, title: string): Promise<void> {
  const { error } = await supabase.from("voice_memos").update({ title: title || null }).eq("id", memoId);
  if (error) throw error;
}

export async function updateMemoNotes(memoId: string, notes: string): Promise<void> {
  const { error } = await supabase.from("voice_memos").update({ notes: notes || null }).eq("id", memoId);
  if (error) throw error;
}

export async function archiveMemo(memoId: string): Promise<void> {
  const { error } = await supabase.from("voice_memos").update({ status: "archived" as never }).eq("id", memoId);
  if (error) throw error;
}

export async function unarchiveMemo(memoId: string): Promise<void> {
  const { error } = await supabase.from("voice_memos").update({ status: "finalized" }).eq("id", memoId);
  if (error) throw error;
}

export { uploadVoiceMemo, getPlaybackUrl };

/** Friendly "Sunday afternoon · 1 min 12 sec" formatter (client-side mirror of the takes trigger). */
export function friendlyMemoLabel(createdAt: string, durationMs: number | null): string {
  const d = new Date(createdAt);
  const hour = d.getHours();
  const dow = d.getDay();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let bucket: string;
  if (hour >= 5 && hour <= 10) bucket = "morning";
  else if (hour >= 11 && hour <= 13) bucket = "midday";
  else if (hour >= 14 && hour <= 16) bucket = "afternoon";
  else if (hour >= 17 && hour <= 20) bucket = "evening";
  else bucket = "late night";
  const total = Math.round((durationMs ?? 0) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  let dur = "";
  if (total > 0) {
    if (m === 0) dur = ` · ${s} sec`;
    else if (s === 0) dur = ` · ${m} min`;
    else dur = ` · ${m} min ${s} sec`;
  }
  return `${dayNames[dow]} ${bucket}${dur}`;
}