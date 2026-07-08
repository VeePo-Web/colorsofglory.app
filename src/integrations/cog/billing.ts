import { supabase } from "@/integrations/supabase/client";
import type {
  Subscription,
  StorageAddon,
  PlanId,
  PlanKey,
  BillingStatus,
  PlanTier,
  PricingCard,
} from "@/types";

// Billing domain types moved to the @/types barrel (A2 Step 3); re-exported for
// existing deep imports until the Step 10 codemod repoints them.
export type {
  Subscription,
  StorageAddon,
  PlanId,
  PlanKey,
  BillingStatus,
  PlanTier,
  PricingCard,
};

/**
 * One-shot server snapshot of the caller's plan, subscription, storage, and
 * song quota. Prefer this over composing `current_plan` + `subscriptions` +
 * `storage_addons` reads on the client.
 */
export async function getMyBillingStatus(): Promise<BillingStatus> {
  const { data, error } = await supabase.functions.invoke("me-billing-status", { body: {} });
  if (error) throw error;
  return data as BillingStatus;
}

export type PricingPageCopy = {
  h1: string;
  sub_h1: string;
  comparison_caption: string;
  founder_section_heading: string;
  founder_section_body: string;
  referral_section_heading: string;
  referral_section_body: string;
};

export type ValidateCodeResult =
  | { kind: "founder"; discount_pct: 50; effective_cents: 4900; founder_display_name: string; code_id: string }
  | { kind: "member_referral"; referrer_display_name: string; referrer_user_id: string }
  | { kind: "invalid"; reason: "expired" | "not_found" | "wrong_plan" | "self" | "already_attributed" };

type PricingCopyRow = {
  key: string;
  payload: unknown;
};

type CheckoutResponse = {
  clientSecret?: string;
  applied_code_kind?: "founder" | "member_referral" | "none";
  ignored_referrer?: boolean;
  error?: string;
};

// Canonical Stripe price lookup_keys the app ships with. v2 keys
// (starter_monthly, pro_monthly, pro_monthly_referral_50) are the
// authoritative pricing for the new payments system. Legacy CAD keys
// remain for backwards compatibility with old subscription rows but
// MUST NOT be used for new checkouts. Use plan_key instead.
export const PRICE_IDS = {
  starter_monthly: "starter_monthly_cad",
  pro_monthly: "pro_monthly_cad",
  pro_monthly_referral_50: "pro_monthly_referral_50_cad",
  storage_25gb_monthly: "cog_storage_25gb_monthly_cad",
  storage_100gb_monthly: "cog_storage_100gb_monthly_cad",
  storage_500gb_monthly: "cog_storage_500gb_monthly_cad",
  storage_1tb_monthly: "cog_storage_1tb_monthly_cad",
} as const;

export type PriceId = (typeof PRICE_IDS)[keyof typeof PRICE_IDS];

// ---------- v2 SDK ----------

/** Server-side authoritative plan catalog. Public-readable (anon OK). */
export async function getPricingCatalog(): Promise<PlanTier[]> {
  const { data, error } = await supabase
    .from("plan_tiers")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlanTier[];
}

/** Pricing page data: copy + cards in display order. Public-readable. */
export type FaqItem = { q: string; a: string };

export async function getPricingPage(): Promise<{ page: PricingPageCopy; cards: PricingCard[]; faq: FaqItem[] }> {
  const { data, error } = await supabase.from("pricing_copy").select("key, payload");
  if (error) throw error;
  const rows = (data ?? []) as PricingCopyRow[];
  const map = new Map<string, unknown>(rows.map((r) => [r.key, r.payload]));
  const page = map.get("page") as PricingPageCopy;
  const order: PlanKey[] = ["free", "starter", "pro"];
  const cards = order
    .map((k) => map.get(`card_${k}`) as PricingCard | undefined)
    .filter((c): c is PricingCard => !!c);
  const faq = ((map.get("faq") as { items?: FaqItem[] } | undefined)?.items ?? []) as FaqItem[];
  return { page, cards, faq };
}

/** Validate a code BEFORE checkout so the UI can show "Founder code applied — $49/mo". */
export async function validateCode(code: string, plan_key: PlanKey = "pro"): Promise<ValidateCodeResult> {
  const { data, error } = await supabase.functions.invoke("validate-code", {
    body: { code, plan_key },
  });
  if (error) throw error;
  return data as ValidateCodeResult;
}

/** Open an embedded checkout session for the chosen plan, optionally with a code. */
export async function startCheckout(input: {
  plan_key: PlanKey;
  code?: string;
  referrer_code?: string;
  return_url: string;
  environment?: "sandbox" | "live";
}): Promise<{ clientSecret: string; applied_code_kind: "founder" | "member_referral" | "none"; ignored_referrer: boolean }> {
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: {
      plan_key: input.plan_key,
      code: input.code,
      referrer_code: input.referrer_code,
      returnUrl: input.return_url,
      environment: input.environment ?? "sandbox",
    },
  });
  if (error) throw error;
  const result = data as CheckoutResponse | null;
  if (result?.error) throw new Error(result.error);
  if (!result?.clientSecret) throw new Error("checkout_session_failed");
  return {
    clientSecret: result.clientSecret,
    applied_code_kind: result.applied_code_kind ?? "none",
    ignored_referrer: result.ignored_referrer ?? false,
  };
}

/** Caller's referral stats (their code + lifetime member-referral cash earned). */
export async function getMyReferralStats(): Promise<{
  code: string | null;
  active_refs: number;
  lifetime_paid_cents: number;
  pending_cents: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthorized");

  const [{ data: profile }, { data: rewards }, { data: activeAttrs }] = await Promise.all([
    supabase.from("profiles").select("referral_code").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("reward_events")
      .select("amount_cents, status")
      .eq("referrer_user_id", user.id),
    supabase
      .from("referral_attributions")
      .select("id")
      .eq("referrer_user_id", user.id),
  ]);

  let lifetime = 0;
  let pending = 0;
  for (const r of rewards ?? []) {
    if (r.status === "paid") lifetime += r.amount_cents;
    else if (r.status === "pending" || r.status === "payable") pending += r.amount_cents;
  }

  return {
    code: profile?.referral_code ?? null,
    active_refs: activeAttrs?.length ?? 0,
    lifetime_paid_cents: lifetime,
    pending_cents: pending,
  };
}

/** Reads the effective plan for the signed-in user via the SECURITY DEFINER helper. */
export async function getCurrentPlan(userId: string): Promise<PlanId> {
  const { data, error } = await supabase.rpc("current_plan", { _user_id: userId });
  if (error) throw error;
  return (data as PlanId) ?? "free";
}

/** True if the user currently has Pro / Founder Pro access (incl. grace period). */
export async function isProUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_pro_user", { _user_id: userId });
  if (error) throw error;
  return !!data;
}

/** Latest subscription row for a user (any status), or null. */
export async function getLatestSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** All active storage add-ons for a user. */
export async function getStorageAddons(userId: string): Promise<StorageAddon[]> {
  const { data, error } = await supabase
    .from("storage_addons")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"]);
  if (error) throw error;
  return data ?? [];
}

/** Effective storage limit (bytes) for the user: plan base plus active add-ons. */
export async function getEffectiveStorageLimit(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("effective_storage_limit", { _user_id: userId });
  if (error) throw error;
  return Number(data ?? 0);
}

/** True if the user has a founder-code attribution that unlocks the Founder Rate. */
export async function canPurchaseFounderRate(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("referral_attributions")
    .select("referrer_type")
    .eq("referred_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.referrer_type === "founder";
}

/** Server-side checkout session creation. Returns the embedded clientSecret. */
export async function createCheckoutSession(opts: {
  priceId: string;
  returnUrl: string;
  environment?: "sandbox" | "live";
}): Promise<{ clientSecret: string }> {
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: {
      priceId: opts.priceId,
      returnUrl: opts.returnUrl,
      environment: opts.environment ?? "sandbox",
    },
  });
  if (error) throw error;
  if (!data?.clientSecret) throw new Error("checkout_session_failed");
  return { clientSecret: data.clientSecret as string };
}

/** Stripe-hosted billing portal session. Open the returned URL in a new tab. */
export async function openBillingPortal(opts: {
  returnUrl: string;
  environment?: "sandbox" | "live";
}): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke("billing-customer-portal", {
    body: { returnUrl: opts.returnUrl, environment: opts.environment ?? "sandbox" },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("portal_session_failed");
  return { url: data.url as string };
}

/** Cancel the caller's active subscription. Defaults to end-of-period (grace) cancellation. */
export async function cancelSubscription(opts: {
  subscriptionId?: string;
  atPeriodEnd?: boolean;
  environment?: "sandbox" | "live";
} = {}): Promise<{ ok: true; status: string; cancel_at_period_end: boolean }> {
  const { data, error } = await supabase.functions.invoke("billing-cancel-subscription", {
    body: {
      subscription_id: opts.subscriptionId,
      at_period_end: opts.atPeriodEnd ?? true,
      environment: opts.environment ?? "sandbox",
    },
  });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as { ok: true; status: string; cancel_at_period_end: boolean };
}

// ---------- §7 brief aliases ----------
// Thin re-exports under the exact names the v2 brief specified, so
// consumers can import them verbatim. Implementation is unchanged.
export const getMySubscription = getLatestSubscription;
export const getMyFounderStats = canPurchaseFounderRate;
export async function purchaseStorageAddon(addonPriceId: string, returnUrl: string, environment: "sandbox" | "live" = "sandbox") {
  return createCheckoutSession({ priceId: addonPriceId, returnUrl, environment });
}
