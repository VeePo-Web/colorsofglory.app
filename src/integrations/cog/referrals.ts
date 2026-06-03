import { supabase } from "@/integrations/supabase/client";

export type ResolvedCode = {
  ok: boolean;
  kind?: "founder" | "user_referral" | "internal";
  owner_display_name?: string | null;
  code?: string | null;
  discount_cents?: number;
};

export async function resolveCode(input: { code?: string; slug?: string }): Promise<ResolvedCode> {
  const { data, error } = await supabase.functions.invoke("referral-resolve", { body: input });
  if (error) throw error;
  return data as ResolvedCode;
}

export async function attachReferral(code: string, source: "founder_code" | "user_referral_code" | "invite_link" = "founder_code") {
  const { data, error } = await supabase.functions.invoke("referral-attach", { body: { code, source } });
  if (error) throw error;
  return data;
}

export async function getMyAttribution() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from("referral_attributions")
    .select("*")
    .eq("referred_user_id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyCredits() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("credit_ledger")
    .select("*")
    .eq("user_id", u.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getMyRewardSummary() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { rewards: [], total_pending_cents: 0, total_payable_cents: 0, total_paid_cents: 0 };
  const { data, error } = await supabase
    .from("reward_events")
    .select("id, amount_cents, status, reward_kind, created_at, hold_until, invoice_external_id")
    .or(`referrer_user_id.eq.${u.user.id}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rewards = data ?? [];
  const sum = (s: string) => rewards.filter((r) => r.status === s).reduce((a, r) => a + (r.amount_cents ?? 0), 0);
  return {
    rewards,
    total_pending_cents: sum("pending"),
    total_payable_cents: sum("payable"),
    total_paid_cents: sum("paid"),
  };
}