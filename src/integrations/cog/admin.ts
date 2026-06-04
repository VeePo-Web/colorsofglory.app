import { supabase } from "@/integrations/supabase/client";

// =========================================================================
// Direct admin RPCs (internal dashboard) — see migrations 20260604062*.
// All RPCs are SECURITY DEFINER and check has_role(auth.uid(),'admin').
// =========================================================================

export type RewardProfile = {
  first6_cents: number;
  ongoing_cents: number;
  first6_months?: number;
};

export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: u.user.id,
    _role: "admin" as never,
  });
  if (error) return false;
  return Boolean(data);
}

export async function adminCreateFounder(input: {
  display_name: string;
  slug: string;
  reward_profile?: RewardProfile | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase.rpc("admin_create_founder", {
    _display_name: input.display_name,
    _slug: input.slug,
    _reward_profile: (input.reward_profile ?? null) as never,
    _notes: input.notes ?? null,
  });
  if (error) throw error;
  return data;
}

export async function adminCreateFounderCode(input: {
  founder_id: string;
  code: string;
  max_redemptions?: number | null;
  expires_at?: string | null;
  label?: string | null;
}) {
  const { data, error } = await supabase.rpc("admin_create_founder_code", {
    _founder_id: input.founder_id,
    _code: input.code,
    _max_redemptions: input.max_redemptions ?? null,
    _expires_at: input.expires_at ?? null,
    _label: input.label ?? null,
  });
  if (error) throw error;
  return data;
}

export async function adminDeactivateCode(code_id: string) {
  const { data, error } = await supabase.rpc("admin_deactivate_code", { _code_id: code_id });
  if (error) throw error;
  return data;
}

export async function adminFounderSummary() {
  const { data, error } = await supabase.rpc("admin_founder_summary");
  if (error) throw error;
  return data ?? [];
}

export async function adminFounderDetail(founder_id: string) {
  const { data, error } = await supabase.rpc("admin_founder_detail", { _founder_id: founder_id });
  if (error) throw error;
  return data;
}

export async function adminReferralsRecent(limit = 50) {
  const { data, error } = await supabase.rpc("admin_referrals_recent", { _limit: limit });
  if (error) throw error;
  return data ?? [];
}

export async function adminMonthlyPayouts(month_start?: string) {
  const { data, error } = await supabase.rpc(
    "admin_monthly_payouts",
    month_start ? { _month_start: month_start } : ({} as never),
  );
  if (error) throw error;
  return data ?? [];
}

// =========================================================================
// Legacy edge-function-based admin SDK (kept for compatibility).
// =========================================================================

type CreateFounderInput = {
  display_name: string;
  slug: string;
  tier?: "standard" | "strategic" | "internal";
  user_id?: string;
  code_value?: string;
  discount_cents?: number;
  reward_profile?: { first6_cents: number; ongoing_cents: number; first6_months?: number };
};

async function callAdmin(fn: string, body: unknown) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data;
}

export const createFounder = (input: CreateFounderInput) =>
  callAdmin("admin-founders", { action: "create", ...input });

export const pauseFounder = (founder_id: string, reason?: string) =>
  callAdmin("admin-founders", { action: "pause", founder_id, reason });

export const resumeFounder = (founder_id: string, reason?: string) =>
  callAdmin("admin-founders", { action: "resume", founder_id, reason });

export const revokeFounder = (founder_id: string, reason?: string) =>
  callAdmin("admin-founders", { action: "revoke", founder_id, reason });

export const editRewardProfile = (founder_id: string, reward_profile: CreateFounderInput["reward_profile"], reason?: string) =>
  callAdmin("admin-founders", { action: "edit_reward_profile", founder_id, reward_profile, reason });

export const overrideAttribution = (
  referred_user_id: string,
  new_referrer_type: "founder" | "user",
  new_referrer_id: string,
  reason?: string,
) => callAdmin("admin-attribution-override", { referred_user_id, new_referrer_type, new_referrer_id, reason });

export const listDraftPayouts = () => callAdmin("admin-payouts", { action: "list_drafts" });
export const createPayoutBatch = (founder_id: string, period_start: string, period_end: string) =>
  callAdmin("admin-payouts", { action: "create_batch", founder_id, period_start, period_end });
export const approvePayout = (payout_id: string) => callAdmin("admin-payouts", { action: "approve", payout_id });
export const markPayoutPaid = (payout_id: string, provider_id: string) =>
  callAdmin("admin-payouts", { action: "mark_paid", payout_id, provider_id });
export const markPayoutFailed = (payout_id: string, reason: string) =>
  callAdmin("admin-payouts", { action: "mark_failed", payout_id, reason });