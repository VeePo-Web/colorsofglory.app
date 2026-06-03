import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type PlanId = "free" | "pro" | "founder_pro";

// Single canonical price IDs the app ships with. Add more here as you
// create new products via the payments tool.
export const PRICE_IDS = {
  pro_monthly: "cog_pro_monthly",
} as const;

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