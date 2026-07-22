import { supabase } from "@/integrations/supabase/client";
import { CogError, toCogError } from "./errors";

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
  if (error) throw toCogError(error);
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
  if (error) throw toCogError(error);
  return data;
}

export async function adminDeactivateCode(code_id: string) {
  const { data, error } = await supabase.rpc("admin_deactivate_code", { _code_id: code_id });
  if (error) throw toCogError(error);
  return data;
}

export async function adminFounderSummary() {
  const { data, error } = await supabase.rpc("admin_founder_summary");
  if (error) throw toCogError(error);
  return data ?? [];
}

export type AdminFounderCodeRow = {
  id: string;
  value: string;
  status: string;
  owner_founder_id: string | null;
  redemption_count: number | null;
  max_redemptions: number | null;
  expires_at: string | null;
  created_at: string;
};

/**
 * All founder codes (admin console) — newest first. Backs both the Founders
 * search-by-code index and the Codes table; RLS restricts reads to admins.
 */
export async function adminListFounderCodes(): Promise<AdminFounderCodeRow[]> {
  const { data, error } = await supabase
    .from("codes")
    .select("id, value, status, owner_founder_id, redemption_count, max_redemptions, expires_at, created_at")
    .eq("kind", "founder")
    .order("created_at", { ascending: false });
  if (error) throw toCogError(error);
  return (data ?? []) as AdminFounderCodeRow[];
}

export async function adminFounderDetail(founder_id: string) {
  const { data, error } = await supabase.rpc("admin_founder_detail", { _founder_id: founder_id });
  if (error) throw toCogError(error);
  return data;
}

export async function adminReferralsRecent(limit = 50) {
  const { data, error } = await supabase.rpc("admin_referrals_recent", { _limit: limit });
  if (error) throw toCogError(error);
  return data ?? [];
}

export type AttentionSummary = {
  open_fraud_flags: number;
  stuck_webhooks: number;
  draft_payouts_count: number;
  draft_payouts_cents: number;
  reward_payable_cents: number;
  blocked_payout_count: number;
  blocked_payout_cents: number;
};

/** Admin Home "needs attention" cockpit — things requiring intervention now. */
export async function adminAttentionSummary(): Promise<AttentionSummary> {
  const { data, error } = await supabase.rpc("admin_attention_summary" as never);
  if (error) throw toCogError(error);
  return data as unknown as AttentionSummary;
}

// ── Auth security (phone OTP toll-fraud monitoring) ──────────────────────
export type OtpStats = {
  sends_24h: number;
  sends_1h: number;
  distinct_phones_24h: number;
  distinct_ips_24h: number;
  top_phones: Array<{ phone_e164: string; n: number }>;
  settings: Record<string, unknown>;
};

export async function adminOtpStats(): Promise<OtpStats> {
  const { data, error } = await supabase.rpc("admin_otp_stats" as never);
  if (error) throw toCogError(error);
  return data as unknown as OtpStats;
}

/** Tune an otp_* app setting (e.g. geo allowlist, daily ceiling). Audited. */
export async function adminSetAppSetting(key: string, value: unknown): Promise<void> {
  const { error } = await supabase.rpc("admin_set_app_setting" as never, { _key: key, _value: value } as never);
  if (error) throw toCogError(error);
}

export type FinanceSummary = {
  generated_at: string;
  mrr_cents: number;
  active_subs: number;
  mrr_by_plan: Record<string, number>;
  subs_by_plan: Record<string, number>;
  new_subs_30d: number;
  churned_30d: number;
  reward_liability_cents: number;
  reward_pending_cents: number;
  reward_payable_cents: number;
  payouts_outstanding_cents: number;
  payouts_paid_lifetime_cents: number;
  payouts_paid_30d_cents: number;
  refunds_30d_cents: number;
  chargebacks_30d_cents: number;
};

/** Reconciled finance snapshot (admin only). Numbers trace to Stripe-sourced rows. */
export async function adminFinanceSummary(): Promise<FinanceSummary> {
  const { data, error } = await supabase.rpc("admin_finance_summary" as never);
  if (error) throw toCogError(error);
  return data as unknown as FinanceSummary;
}

// ── Payout console ───────────────────────────────────────────────────────
export type PayoutRow = {
  id: string;
  founder_id: string | null;
  user_id: string | null;
  period_start: string;
  period_end: string;
  amount_cents: number;
  currency: string;
  status: "draft" | "approved" | "processing" | "paid" | "failed";
  provider: string | null;
  provider_payout_id: string | null;
  failure_reason: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export async function adminListPayouts(limit = 100): Promise<PayoutRow[]> {
  const { data, error } = await supabase.rpc("admin_list_payouts" as never, { _limit: limit } as never);
  if (error) throw toCogError(error);
  return (data ?? []) as unknown as PayoutRow[];
}

// ── Webhook ops ──────────────────────────────────────────────────────────
export type BillingEventRow = {
  id: string;
  external_event_id: string;
  kind: string;
  user_id: string | null;
  amount_cents: number | null;
  currency: string | null;
  created_at: string;
  processed_at: string | null;
  processing_error: string | null;
};

export async function adminBillingEvents(limit = 50, onlyFailed = false): Promise<BillingEventRow[]> {
  const { data, error } = await supabase.rpc("admin_billing_events" as never, {
    _limit: limit,
    _only_failed: onlyFailed,
  } as never);
  if (error) throw toCogError(error);
  return (data ?? []) as unknown as BillingEventRow[];
}

/** Re-drive a stuck billing event by re-running its idempotent money RPC. */
export const redriveBillingEvent = (id: string) =>
  callAdmin("admin-redrive-billing-event", { id });

// ── Fraud review ─────────────────────────────────────────────────────────
export type FraudFlag = {
  id: string;
  subject_type: "user" | "founder";
  subject_id: string;
  reason: string;
  severity: string;
  created_by_user_id: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
};

export async function adminFraudFlags(onlyOpen = true, limit = 100): Promise<FraudFlag[]> {
  const { data, error } = await supabase.rpc("admin_fraud_flags" as never, {
    _only_open: onlyOpen,
    _limit: limit,
  } as never);
  if (error) throw toCogError(error);
  return (data ?? []) as unknown as FraudFlag[];
}

export async function adminCreateFraudFlag(input: {
  subject_type: "user" | "founder";
  subject_id: string;
  reason: string;
  severity?: string;
}): Promise<FraudFlag> {
  const { data, error } = await supabase.rpc("admin_create_fraud_flag" as never, {
    _subject_type: input.subject_type,
    _subject_id: input.subject_id,
    _reason: input.reason,
    _severity: input.severity ?? "low",
  } as never);
  if (error) throw toCogError(error);
  return data as unknown as FraudFlag;
}

export async function adminResolveFraudFlag(id: string, note?: string): Promise<FraudFlag> {
  const { data, error } = await supabase.rpc("admin_resolve_fraud_flag" as never, {
    _id: id,
    _note: note ?? null,
  } as never);
  if (error) throw toCogError(error);
  return data as unknown as FraudFlag;
}

// ── Referrer payments ledger ─────────────────────────────────────────────
export type ReferrerLedgerRow = {
  referrer_type: "founder" | "user";
  referrer_id: string;
  recipient_user_id: string;
  name: string | null;
  referral_code: string | null;
  attributed_count: number;
  paying_count: number;
  pending_cents: number;
  payable_cents: number;
  paid_cents: number;
  payout_method: string | null;
};

/** Per-referrer tracker: referrals + earnings + whether they can be paid. */
export async function adminReferrerLedger(): Promise<ReferrerLedgerRow[]> {
  const { data, error } = await supabase.rpc("admin_referrer_ledger" as never);
  if (error) throw toCogError(error);
  return (data ?? []) as unknown as ReferrerLedgerRow[];
}

// ── Attribution override ─────────────────────────────────────────────────
export type CurrentAttribution = {
  exists: boolean;
  referrer_type?: "user" | "founder";
  referrer_user_id?: string | null;
  referrer_founder_id?: string | null;
  source?: string | null;
  locked?: boolean;
  referrer_name?: string | null;
};

/** Read the current referral attribution for a referred user (admin). */
export async function adminAttributionForUser(userId: string): Promise<CurrentAttribution> {
  const { data, error } = await supabase.rpc("admin_attribution_for_user" as never, { _user: userId } as never);
  if (error) throw toCogError(error);
  return data as unknown as CurrentAttribution;
}

export async function adminMonthlyPayouts(month_start?: string) {
  const { data, error } = await supabase.rpc(
    "admin_monthly_payouts",
    month_start ? { _month_start: month_start } : ({} as never),
  );
  if (error) throw toCogError(error);
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
  if (error) throw toCogError(error);
  if ((data as { error?: string })?.error) throw new CogError("INTERNAL", (data as { error: string }).error);
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
export const retryPayout = (payout_id: string) => callAdmin("admin-payouts", { action: "retry", payout_id });
export const createPayoutBatch = (founder_id: string, period_start: string, period_end: string) =>
  callAdmin("admin-payouts", { action: "create_batch", founder_id, period_start, period_end });
export const approvePayout = (payout_id: string) => callAdmin("admin-payouts", { action: "approve", payout_id });
export const markPayoutPaid = (payout_id: string, provider_id: string) =>
  callAdmin("admin-payouts", { action: "mark_paid", payout_id, provider_id });
export const markPayoutFailed = (payout_id: string, reason: string) =>
  callAdmin("admin-payouts", { action: "mark_failed", payout_id, reason });
// Global payout kill switch: frozen blocks approve + mark_paid everywhere
// (accrual, maturation, and monthly drafting keep running). Freezing requires
// a reason so the audit log always says why money stopped.
export const getPayoutFreezeStatus = (): Promise<{ ok: boolean; frozen: boolean }> =>
  callAdmin("admin-payouts", { action: "freeze_status" });
export const setPayoutsFrozen = (frozen: boolean, reason?: string): Promise<{ ok: boolean; frozen: boolean }> =>
  callAdmin("admin-payouts", { action: "set_frozen", frozen, reason });

// =========================================================================
// Audit log search (admin only) — backed by admin-audit-search edge function.
// =========================================================================

export type AuditSearchFilters = {
  invoice_id?: string;
  referrer_user_id?: string;
  referred_user_id?: string;
  reversed_reason?: string;
  action?: string;
  entity_type?: string;
  since?: string; // ISO timestamp
  until?: string; // ISO timestamp
  limit?: number;
  offset?: number;
};

export type AuditLogRow = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  actor_user_id: string | null;
  referred_user_id: string | null;
  referrer_user_id: string | null;
  referrer_founder_id: string | null;
  invoice_id: string | null;
  reason: string | null;
  reversed_reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export type AuditSearchResult = {
  rows: AuditLogRow[];
  total: number;
  has_more: boolean;
  limit: number;
  offset: number;
};

export async function searchAuditLogs(filters: AuditSearchFilters = {}): Promise<AuditSearchResult> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") body[k] = v;
  }
  const { data, error } = await supabase.functions.invoke("admin-audit-search", { body });
  if (error) throw toCogError(error);
  if ((data as { error?: string })?.error) throw new CogError("INTERNAL", (data as { error: string }).error);
  return data as AuditSearchResult;
}