/**
 * "The song is finished" seam (R38 audit).
 *
 * The one goal of the song room is to finish a song. Until now the room had
 * no ending — a song just stopped being touched. This module gives the owner
 * one calm, reversible act: mark the song finished (and reopen it later).
 *
 * Backend contract:
 *   finish_song(_song_id uuid) -> timestamptz   owner-only, idempotent
 *   reopen_song(_song_id uuid) -> void          owner-only, idempotent
 * Both write a `song_activity` row (`song_finished` / `song_reopened`), so the
 * feed tells the story without any extra client emit.
 *
 * `songs.finished_at` is the ONLY new state. No new enum, no lock, no gate:
 * a finished song stays fully editable. Finishing is a marker of intent, not
 * a permission change — the simple choice over a workflow.
 *
 * Recommended pairing (frontend): before calling `finishSong`, save a version
 * labelled "Final" via versions.saveVersion so the finished shape is pinned in
 * history. That is a UI decision, not a backend requirement.
 */

import { supabase } from "@/integrations/supabase/client";
import { CogError } from "./songs";

export type FinishState = {
  finishedAt: string | null;
  isFinished: boolean;
};

function fail(err: { code?: string | null; message?: string } | null): never {
  const code = err?.message?.includes("NOT_OWNER") ? "NOT_OWNER" : (err?.code ?? "INTERNAL");
  throw new CogError(
    code,
    code === "NOT_OWNER"
      ? "Only the song's owner can finish or reopen this song."
      : (err?.message ?? "Something went wrong."),
  );
}

/** Mark the song finished. Idempotent — returns the original finish time. */
export async function finishSong(songId: string): Promise<FinishState> {
  const { data, error } = await (supabase as any).rpc("finish_song", { _song_id: songId });
  if (error) fail(error);
  const finishedAt = (data as string | null) ?? new Date().toISOString();
  return { finishedAt, isFinished: true };
}

/** Clear the finished marker. Idempotent. */
export async function reopenSong(songId: string): Promise<FinishState> {
  const { error } = await (supabase as any).rpc("reopen_song", { _song_id: songId });
  if (error) fail(error);
  return { finishedAt: null, isFinished: false };
}

/** Read the current marker (cheap single-column read for the room header). */
export async function fetchFinishState(songId: string): Promise<FinishState> {
  const { data, error } = await (supabase as any)
    .from("songs")
    .select("finished_at")
    .eq("id", songId)
    .maybeSingle();
  if (error) fail(error);
  const finishedAt = (data?.finished_at as string | null) ?? null;
  return { finishedAt, isFinished: Boolean(finishedAt) };
}

/** One warm line for the header. Pure. */
export function finishedLine(state: FinishState, locale = "en-US"): string | null {
  if (!state.finishedAt) return null;
  const d = new Date(state.finishedAt);
  return `Finished ${d.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}`;
}
