import { supabase } from "@/integrations/supabase/client";

export type FounderStats = {
  is_founder: boolean;
  display_name?: string | null;
  status?: string | null;
  code?: string | null;
  share_link?: string | null;
  redemptions_used?: number;
  redemptions_cap?: number | null;
  code_expires_at?: string | null;
  attributed_count?: number;
  paying_count?: number;
  earnings?: {
    pending_cents: number;
    payable_cents: number;
    paid_cents: number;
    lifetime_cents: number;
  };
  next_payout_estimate_cents?: number;
  next_draft_date?: string;
  recent_paid_invoices?: Array<{
    invoice_external_id: string | null;
    amount_cents: number;
    month_index: number | null;
    status: string;
    created_at: string;
  }>;
};

/**
 * Single-call founder dashboard payload: code + redemption stats +
 * earnings breakdown + next monthly payout-draft date.
 * Returns `{ is_founder: false }` for non-founders.
 */
export async function getMyFounderStats(): Promise<FounderStats> {
  const { data, error } = await supabase.functions.invoke("me-founder-stats", { body: {} });
  if (error) throw error;
  return data as FounderStats;
}

export async function getMyFounderProfile() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from("founders")
    .select("*, codes:codes(*)")
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMyReferredUsers() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data: founder } = await supabase
    .from("founders").select("id").eq("user_id", u.user.id).maybeSingle();
  if (!founder) return [];
  const { data, error } = await supabase
    .from("referral_attributions")
    .select("*")
    .eq("referrer_founder_id", founder.id);
  if (error) throw error;
  return data ?? [];
}

export async function getMyMonthlyEarnings() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { rewards: [], by_status: {} as Record<string, number> };
  const { data: founder } = await supabase
    .from("founders").select("id").eq("user_id", u.user.id).maybeSingle();
  if (!founder) return { rewards: [], by_status: {} as Record<string, number> };
  const { data, error } = await supabase
    .from("reward_events")
    .select("*")
    .eq("referrer_founder_id", founder.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rewards = data ?? [];
  const by_status: Record<string, number> = {};
  for (const r of rewards) by_status[r.status] = (by_status[r.status] ?? 0) + (r.amount_cents ?? 0);
  return { rewards, by_status };
}