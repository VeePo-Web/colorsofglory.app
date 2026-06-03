import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type StorageAddon = Database["public"]["Tables"]["storage_addons"]["Row"];
export type PlanId = "free" | "pro" | "founder_pro";

// Single canonical price IDs the app ships with. Add more here as you
// create new products via the payments tool.
export const PRICE_IDS = {
  pro_monthly: "cog_pro_monthly_cad",
  founder_pro_monthly: "cog_founder_pro_monthly_cad",
  storage_25gb_monthly: "cog_storage_25gb_monthly_cad",
  storage_100gb_monthly: "cog_storage_100gb_monthly_cad",
  storage_500gb_monthly: "cog_storage_500gb_monthly_cad",
  storage_1tb_monthly: "cog_storage_1tb_monthly_cad",
} as const;

export type PriceId = (typeof PRICE_IDS)[keyof typeof PRICE_IDS];

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

/** Effective storage limit (bytes) for the user — plan base + active add-ons. */
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