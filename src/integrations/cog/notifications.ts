// Email preferences + feature-usage seam. Claude's UI reads/writes here.
// The `markFeatureUsed` call is fire-and-forget: it prevents future L11
// education/nudge emails from re-suggesting a feature the user already used.

import { supabase } from "@/integrations/supabase/client";

export interface EmailPreferences {
  unsubscribed_all: boolean;
  song_activity: boolean;
  weekly_recaps: boolean;
  tips_guides: boolean;
  invite_suggestions: boolean;
  encouragement: boolean;
  product_news: boolean;
}

const DEFAULTS: EmailPreferences = {
  unsubscribed_all: false,
  song_activity: true,
  weekly_recaps: true,
  tips_guides: true,
  invite_suggestions: true,
  encouragement: true,
  product_news: true,
};

export async function getEmailPreferences(): Promise<EmailPreferences> {
  const { data, error } = await supabase
    .from("email_preferences")
    .select("unsubscribed_all, song_activity, weekly_recaps, tips_guides, invite_suggestions, encouragement, product_news")
    .maybeSingle();
  if (error) throw error;
  return { ...DEFAULTS, ...(data ?? {}) };
}

export async function updateEmailPreferences(patch: Partial<EmailPreferences>): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("auth_required");
  const { error } = await supabase
    .from("email_preferences")
    .upsert({ user_id: uid, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Fire-and-forget. Silently no-ops if signed out. */
export function markFeatureUsed(feature: string): void {
  void supabase.rpc("mark_feature_used", { _feature: feature }).then(({ error }) => {
    if (error) console.warn("markFeatureUsed", feature, error.message);
  });
}