// L11 email data seam. UI-agnostic wrappers around email_preferences
// (owner-RLS) and the mark_feature_used SECURITY DEFINER RPC.

import { supabase } from "@/integrations/supabase/client";
import { CogError } from "./errors";

export interface EmailPreferences {
  user_id: string;
  unsubscribed_all: boolean;
  song_activity: boolean;
  weekly_recaps: boolean;
  tips_guides: boolean;
  invite_suggestions: boolean;
  encouragement: boolean;
  product_news: boolean;
  updated_at: string;
}

export type EmailPreferencePatch = Partial<
  Omit<EmailPreferences, "user_id" | "updated_at">
>;

/** Read the signed-in user's email preferences (row is auto-provisioned on signup). */
export async function getEmailPreferences(): Promise<EmailPreferences | null> {
  const { data, error } = await supabase
    .from("email_preferences")
    .select("*")
    .maybeSingle();
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
  return (data as EmailPreferences | null) ?? null;
}

/** Patch the signed-in user's email preferences. Returns the updated row. */
export async function setEmailPreferences(
  patch: EmailPreferencePatch,
): Promise<EmailPreferences> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new CogError("UNAUTHENTICATED", "sign in required");
  const { data, error } = await supabase
    .from("email_preferences")
    .update(patch)
    .eq("user_id", uid)
    .select("*")
    .single();
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
  return data as EmailPreferences;
}

/** Master pause switch. `true` mutes every lifecycle email. */
export function pauseAllEmail(paused: boolean): Promise<EmailPreferences> {
  return setEmailPreferences({ unsubscribed_all: paused });
}

/**
 * Record that this user has used a feature (idempotent). Powers the email
 * brain's "don't nudge someone about a feature they already use" gate.
 * Canonical feature strings: "voice_memo_created", "lyrics_edited",
 * "chord_set", "canvas_open", "listen_path", "metronome", "compare_mode",
 * "version_history_open", "credits_open", "invite_sent".
 */
export async function markFeatureUsed(feature: string): Promise<void> {
  const { error } = await supabase.rpc("mark_feature_used", { _feature: feature });
  if (error) throw new CogError(error.code ?? "INTERNAL", error.message);
}