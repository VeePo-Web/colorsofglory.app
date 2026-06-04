import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

// Spec §6: an already-Pro user pastes a founder code. We swap the
// subscription item to the $49 referral price and let the next
// invoice.paid mint the founder's reward through the normal webhook
// path. No retroactive credit for prior months.

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({} as any));
    const code = String(body.code ?? "").trim().toUpperCase();
    const environment: StripeEnv = body.environment === "live" ? "live" : "sandbox";
    if (!/^[A-Z0-9_-]{1,64}$/.test(code)) return json({ error: "invalid_code" }, 400);

    // One code per buyer.
    const { data: existingAttr } = await admin
      .from("referral_attributions")
      .select("id")
      .eq("referred_user_id", user.id)
      .maybeSingle();
    if (existingAttr) return json({ error: "already_attributed" }, 409);

    // Resolve founder code.
    const { data: founderCode } = await admin
      .from("codes")
      .select("id, owner_founder_id, status, expires_at, max_redemptions, redemption_count")
      .eq("value", code)
      .eq("kind", "founder")
      .maybeSingle();
    if (!founderCode || !founderCode.owner_founder_id || founderCode.status !== "active") {
      return json({ error: "invalid_code" }, 400);
    }
    if (founderCode.expires_at && new Date(founderCode.expires_at) <= new Date()) {
      return json({ error: "expired" }, 400);
    }
    if (founderCode.max_redemptions !== null &&
        founderCode.redemption_count >= founderCode.max_redemptions) {
      return json({ error: "exhausted" }, 400);
    }
    const { data: founder } = await admin
      .from("founders")
      .select("id, user_id, status")
      .eq("id", founderCode.owner_founder_id)
      .maybeSingle();
    if (!founder || founder.status !== "active") return json({ error: "invalid_code" }, 400);
    if (founder.user_id === user.id) return json({ error: "self" }, 400);

    // Find an active Pro subscription owned by this user.
    const { data: sub } = await admin
      .from("subscriptions")
      .select("external_id, plan, status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub || (sub.plan !== "pro" && sub.plan !== "founder_pro")) {
      return json({ error: "no_active_pro_subscription" }, 404);
    }
    if (sub.plan === "founder_pro") {
      return json({ error: "already_on_founder_rate" }, 409);
    }

    // Resolve target price via lookup_key.
    const stripe = createStripeClient(environment);
    // Source the lookup key from plan_tiers so the CAD/USD switch is the
    // only place we have to maintain.
    const { data: tier } = await admin
      .from("plan_tiers")
      .select("stripe_referral_price_id")
      .eq("key", "pro")
      .maybeSingle();
    const referralLookupKey = tier?.stripe_referral_price_id || "pro_monthly_referral_50_cad";
    const prices = await stripe.prices.list({ lookup_keys: [referralLookupKey] });
    if (!prices.data.length) return json({ error: "referral_price_missing" }, 500);
    const targetPriceId = prices.data[0].id;

    // Swap the subscription item to the discounted price, prorate.
    const stripeSub = await stripe.subscriptions.retrieve(sub.external_id);
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) return json({ error: "no_subscription_item" }, 500);
    await stripe.subscriptions.update(sub.external_id, {
      items: [{ id: itemId, price: targetPriceId }],
      proration_behavior: "create_prorations",
      metadata: {
        ...(stripeSub.metadata ?? {}),
        applied_code_kind: "founder",
        attribution_founder_id: founder.id,
        attribution_code_id: founderCode.id,
      },
    });

    // Persist attribution + bump redemption count now (webhook is
    // idempotent and will skip).
    await admin.from("referral_attributions").insert({
      referred_user_id: user.id,
      referrer_type: "founder",
      referrer_founder_id: founder.id,
      source: "founder_code",
      locked: true,
    });
    await admin.rpc("increment_founder_code_redemption", { _code_id: founderCode.id });
    await admin.rpc("clear_pending_code", { _user_id: user.id });

    // Best-effort effective_cents from the Stripe price (already in cents).
    const effectiveCents = prices.data[0].unit_amount ?? 4900;
    return json({ ok: true, effective_cents: effectiveCents, applied_code_kind: "founder" });
  } catch (e) {
    console.error("apply-founder-code-to-active-sub error", e);
    return json({ error: (e as Error).message }, 500);
  }
});