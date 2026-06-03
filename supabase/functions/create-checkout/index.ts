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
    const priceId: string = body.priceId;
    const environment: StripeEnv = body.environment === "live" ? "live" : "sandbox";
    const returnUrl: string | undefined = body.returnUrl;

    if (!priceId || !/^[a-zA-Z0-9_-]+$/.test(priceId)) {
      return json({ error: "invalid_price_id" }, 400);
    }
    if (!returnUrl || !/^https?:\/\//.test(returnUrl)) {
      return json({ error: "invalid_return_url" }, 400);
    }

    // Founder-rate gating: only users with an active founder-code attribution
    // may purchase the discounted Founder Pro plan. The frontend should prompt
    // for a code (calling `referral-attach`) before retrying checkout.
    if (priceId === "cog_founder_pro_monthly") {
      const { data: attr, error: attrErr } = await supabaseAdmin
        .from("referral_attributions")
        .select("id, referrer_type")
        .eq("referred_user_id", user.id)
        .maybeSingle();
      if (attrErr) return json({ error: "attribution_lookup_failed" }, 500);
      if (!attr || attr.referrer_type !== "founder") {
        return json({ error: "founder_code_required" }, 403);
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

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer: customerId,
      managed_payments: { enabled: true },
      metadata: { userId: user.id, lookup_key: priceId, managed_payments: "true" },
      ...(isRecurring && {
        subscription_data: { metadata: { userId: user.id, lookup_key: priceId } },
      }),
      ...(!isRecurring && productDescription && {
        payment_intent_data: { description: productDescription },
      }),
    });

    return json({ clientSecret: session.client_secret });
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