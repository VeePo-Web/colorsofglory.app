import { supabase } from "@/integrations/supabase/client";

export const REFERRAL_SHARE_BASE = "https://colorsofglory.app/r/";
export function buildReferralShareUrl(code: string): string {
  return `${REFERRAL_SHARE_BASE}${code}`;
}

export type MyReferralsSummary = {
  code: string | null;
  link: string | null;
  /** Prefilled, on-brand message for one-tap sharing (null until a code exists). */
  share_message: string | null;
  /** What the referred friend gets — surface this in the share UI. */
  referee_benefit: string;
  attributed_count: number;
  paying_count: number;
  per_referral_cents: number;
  monthly_recurring_cents: number;
  earnings: {
    pending_cents: number;
    payable_cents: number;
    paid_cents: number;
    lifetime_cents: number;
  };
  next_payout_estimate_cents: number;
  recent_referrals: Array<{
    referred_at: string;
    is_paying: boolean;
    has_paid_before: boolean;
    total_earned_cents: number;
  }>;
  payout_method: {
    kind: "manual" | "paypal" | "stripe_connect" | null;
    email: string | null;
    country: string | null;
  };
};

export async function getMyReferrals(): Promise<MyReferralsSummary> {
  const { data, error } = await supabase.functions.invoke("me-referrals");
  if (error) throw error;
  return data as MyReferralsSummary;
}

/**
 * Claim a memorable/vanity referral code (3–20 chars, A–Z/0–9). Returns the
 * normalized code. Throws 'code_taken' / 'invalid_code' on conflict. The DB
 * trigger keeps the /r/:code resolver in sync automatically.
 */
export async function claimReferralCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("claim_referral_code" as never, { _code: code } as never);
  if (error) throw error;
  return data as unknown as string;
}

export type PayoutMethodInput = {
  method: "manual" | "paypal" | "stripe_connect";
  email?: string | null;
  country?: string | null;
};
export async function setMyPayoutMethod(input: PayoutMethodInput) {
  const { data, error } = await supabase.functions.invoke("me-set-payout-method", { body: input });
  if (error) throw error;
  return data as { ok: true };
}

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

/**
 * v2: stashes a code on the user's profile for checkout to consume.
 * No longer writes a permanent attribution row — that happens in the
 * payments webhook once Stripe confirms the subscription.
 *
 * Returns `{ ok: true, kind: 'founder' | 'member_referral', pending_code }`.
 * The `source` arg is accepted for backwards compatibility but ignored.
 */
export async function attachReferral(code: string, _source?: string) {
  const { data, error } = await supabase.functions.invoke("referral-attach", { body: { code } });
  if (error) throw error;
  return data;
}

/** v2: paste a founder code while already on a paid Pro subscription. */
export async function applyFounderCodeToActiveSub(code: string, environment?: "sandbox" | "live") {
  const { data, error } = await supabase.functions.invoke("apply-founder-code-to-active-sub", {
    body: { code, environment },
  });
  if (error) throw error;
  return data as {
    ok?: boolean;
    error?: string;
    effective_cents?: number;
    applied_code_kind?: "founder";
  };
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