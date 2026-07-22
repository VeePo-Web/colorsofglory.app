// Email preferences + feature-usage seam. Claude's UI reads/writes here.
// The `markFeatureUsed` call is fire-and-forget: it prevents future L11
// education/nudge emails from re-suggesting a feature the user already used.

import { supabase } from "@/integrations/supabase/client";

export type EmailCategory =
  | "onboarding" | "edu" | "collab" | "digest" | "growth" | "retain" | "money" | "care";

export type EmailPreferences = Partial<Record<EmailCategory, boolean>>;

export async function getEmailPreferences(): Promise<EmailPreferences> {
  const { data, error } = await supabase
    .from("email_preferences")
    .select("category, enabled")
    .returns<Array<{ category: EmailCategory; enabled: boolean }>>();
  if (error) throw error;
  const out: EmailPreferences = {};
  for (const row of data ?? []) out[row.category] = row.enabled;
  return out;
}

export async function setEmailPreference(category: EmailCategory, enabled: boolean): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("auth_required");
  const { error } = await supabase
    .from("email_preferences")
    .upsert({ user_id: uid, category, enabled }, { onConflict: "user_id,category" });
  if (error) throw error;
}

/** Fire-and-forget. Silently no-ops if signed out. */
export function markFeatureUsed(feature: string): void {
  void supabase.rpc("mark_feature_used", { _feature: feature }).then(({ error }) => {
    if (error) console.warn("markFeatureUsed", feature, error.message);
  });
}