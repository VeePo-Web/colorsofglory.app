import { supabase } from "@/integrations/supabase/client";

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