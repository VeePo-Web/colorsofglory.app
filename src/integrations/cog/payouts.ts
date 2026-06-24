import { supabase } from "@/integrations/supabase/client";

export type TaxFormType = "W-9" | "W-8BEN" | "W-8BEN-E" | "other";

export type TaxProfile = {
  legal_name: string;
  form_type: TaxFormType;
  country: string;       // ISO-3166 alpha-2
  tax_id_last4?: string | null;
};

/** Upsert the signed-in user's payout tax profile (W-9 / W-8). Required before
 *  an admin can approve their first payout. */
export async function setMyTaxProfile(input: TaxProfile): Promise<{ ok: true }> {
  const { data, error } = await supabase.functions.invoke("me-set-tax-profile", { body: input });
  if (error) throw error;
  return data as { ok: true };
}

/** Returns the signed-in user's tax profile, or null if none on file. */
export async function getMyTaxProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from("payout_tax_profiles")
    .select("legal_name, form_type, country, tax_id_last4, signed_at")
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Download the signed-in user's reward events for the given calendar year as a CSV blob. */
export async function downloadMyEarningsCsv(year: number = new Date().getUTCFullYear()): Promise<Blob> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("not_authenticated");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/me-earnings-export?year=${year}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`earnings_export_failed_${res.status}`);
  return await res.blob();
}