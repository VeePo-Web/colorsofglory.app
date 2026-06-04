import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Look up or create a Stripe Customer keyed by metadata.userId so
// downstream reads (portal, dashboards, subscriptions.search) work.
async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");

  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json({ error: "unauthorized" }, 401);

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({} as any));
    const planKey: string | undefined = body.plan_key;
    let rawCode: string = (body.code ?? "").toString().trim().toUpperCase();
    const rawReferrerCode: string = (body.referrer_code ?? "").toString().trim().toUpperCase();
    let priceId: string | undefined = body.priceId;
    const environment: StripeEnv = body.environment === "live" ? "live" : "sandbox";
    const returnUrl: string | undefined = body.returnUrl ?? body.return_url;

    // Fallback: if the client didn't pass a code, see if onboarding stashed
    // one on the profile (from /invite/:token or the founder-code screen).
    if (!rawCode && !rawReferrerCode) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("pending_code")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof?.pending_code) rawCode = prof.pending_code.toUpperCase();
    }

    // Plan-key path (new v2 API). Resolve server-side, never trust client priceId.
    let appliedCodeKind: "founder" | "member_referral" | "none" = "none";
    let attributionFounderId: string | null = null;
    let attributionCodeId: string | null = null;
    let attributionReferrerUserId: string | null = null;
    let ignoredReferrer = false;

    if (planKey) {
      const { data: tier, error: tierErr } = await supabaseAdmin
        .from("plan_tiers")
        .select("key, stripe_price_id, stripe_referral_price_id, allows_founder_code, allows_member_referral")
        .eq("key", planKey)
        .maybeSingle();
      if (tierErr || !tier) return json({ error: "invalid_plan_key" }, 400);
      if (!tier.stripe_price_id) return json({ error: "plan_not_purchasable" }, 400);

      priceId = tier.stripe_price_id;

      // Single-code-per-buyer enforcement
      if (rawCode || rawReferrerCode) {
        const { data: existingAttr } = await supabaseAdmin
          .from("referral_attributions")
          .select("id")
          .eq("referred_user_id", user.id)
          .maybeSingle();
        if (existingAttr) return json({ error: "already_attributed" }, 409);
      }

      // Try founder code first (Pro only)
      if (tier.allows_founder_code && rawCode) {
        const { data: founderCode } = await supabaseAdmin
          .from("codes")
          .select("id, owner_founder_id, status, expires_at, max_redemptions, redemption_count")
          .eq("value", rawCode)
          .eq("kind", "founder")
          .maybeSingle();
        if (founderCode && founderCode.owner_founder_id && founderCode.status === "active" &&
            (!founderCode.expires_at || new Date(founderCode.expires_at) > new Date()) &&
            (founderCode.max_redemptions === null || founderCode.redemption_count < founderCode.max_redemptions)) {
          const { data: founder } = await supabaseAdmin
            .from("founders")
            .select("id, user_id, status")
            .eq("id", founderCode.owner_founder_id)
            .maybeSingle();
          if (founder && founder.status === "active" && founder.user_id !== user.id) {
            appliedCodeKind = "founder";
            attributionFounderId = founder.id;
            attributionCodeId = founderCode.id;
            if (tier.stripe_referral_price_id) priceId = tier.stripe_referral_price_id;
            if (rawReferrerCode) ignoredReferrer = true;
          }
        }
      }

      // Fall through to member referral if no founder match
      if (appliedCodeKind === "none" && tier.allows_member_referral) {
        const candidate = rawCode || rawReferrerCode;
        if (candidate) {
          const { data: referrer } = await supabaseAdmin
            .from("profiles")
            .select("user_id")
            .eq("referral_code", candidate)
            .maybeSingle();
          if (referrer && referrer.user_id !== user.id) {
            appliedCodeKind = "member_referral";
            attributionReferrerUserId = referrer.user_id;
          }
        }
      }

      // If client supplied a code that didn't resolve to anything, reject
      if (rawCode && appliedCodeKind === "none" && tier.allows_founder_code) {
        return json({ error: "invalid_code" }, 400);
      }
    }

    if (!priceId || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return json({ error: "invalid_price_id" }, 400);
    }
    if (!returnUrl || !/^https?:\/\//.test(returnUrl)) {
      return json({ error: "invalid_return_url" }, 400);
    }

    // Storage add-on gate: only Pro users may purchase storage add-ons.
    if (priceId.startsWith("cog_storage")) {
      const { data: planRow } = await supabaseAdmin
        .rpc("plan_tier_key_for_user", { _user_id: user.id });
      if (planRow !== "pro") {
        return json({ error: "storage_addons_require_pro" }, 403);
      }
    }

    const stripe = createStripeClient(environment);

    const prices = await stripe.prices.list({ lookup_keys: [priceId], expand: ["data.product"] });
    if (!prices.data.length) return json({ error: "price_not_found" }, 404);
    const stripePrice = prices.data[0];
    const isRecurring = stripePrice.type === "recurring";

    const customerId = await resolveOrCreateCustomer(stripe, {
      email: user.email ?? undefined,
      userId: user.id,
    });

    let productDescription: string | undefined;
    if (!isRecurring) {
      const product = typeof stripePrice.product === "string"
        ? await stripe.products.retrieve(stripePrice.product)
        : (stripePrice.product as any);
      productDescription = product?.name;
    }

    const sessionMetadata: Record<string, string> = {
      userId: user.id,
      lookup_key: priceId,
      managed_payments: "true",
      applied_code_kind: appliedCodeKind,
    };
    if (planKey) sessionMetadata.plan_key = planKey;
    if (attributionFounderId) sessionMetadata.attribution_founder_id = attributionFounderId;
    if (attributionReferrerUserId) sessionMetadata.attribution_referrer_user_id = attributionReferrerUserId;

    const subscriptionMetadata: Record<string, string> = { ...sessionMetadata };

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer: customerId,
      managed_payments: { enabled: true },
      metadata: sessionMetadata,
      ...(isRecurring && {
        subscription_data: { metadata: subscriptionMetadata },
      }),
      ...(!isRecurring && productDescription && {
        payment_intent_data: { description: productDescription },
      }),
    });

    return json({
      clientSecret: session.client_secret,
      url: (session as any).url ?? null,
      applied_code_kind: appliedCodeKind,
      ignored_referrer: ignoredReferrer,
    });
  } catch (e) {
    console.error("create-checkout error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}