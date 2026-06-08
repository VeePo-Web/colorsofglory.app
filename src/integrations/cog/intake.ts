import { supabase } from "@/integrations/supabase/client";

/**
 * Share-sheet intake SDK (Pattern 4).
 *
 * Current state: the `voice_memos` table requires a non-null `song_id`, so a
 * pure "Unfiled Inbox" without a song is not yet wired up. This SDK provides:
 *   - submitSharedAudio: upload an audio file shared into the app and attach
 *     it as a voice memo of an existing song the user is a member of.
 *   - listInboxItems: stubbed to [] until a nullable-song_id migration ships.
 *
 * The companion edge function `intake-voice-memo` will own auth/mime/size
 * validation and storage_usage accounting; this SDK is the typed client.
 */

export type SharedAudioInput = {
  file: File | Blob;
  song_id: string;
  title?: string;
};

export type IntakeResult = {
  voice_memo_id: string;
  song_id: string;
};

export async function submitSharedAudio(input: SharedAudioInput): Promise<IntakeResult> {
  const form = new FormData();
  form.append("audio", input.file, (input.file as File).name ?? "shared.webm");
  form.append("song_id", input.song_id);
  if (input.title) form.append("title", input.title);

  const { data, error } = await supabase.functions.invoke<IntakeResult>("intake-voice-memo", {
    body: form,
  });
  if (error) throw error;
  if (!data) throw new Error("Intake returned no data");
  return data;
}

/** Placeholder: full Unfiled Inbox requires a future migration to allow voice_memos.song_id to be NULL. */
export async function listInboxItems(): Promise<never[]> {
  return [];
}