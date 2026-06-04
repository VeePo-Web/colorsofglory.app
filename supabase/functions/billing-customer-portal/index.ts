import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await resolveUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const environment: StripeEnv = body.environment === "live" ? "live" : "sandbox";
    const returnUrl: string | undefined = body.returnUrl;
    if (!returnUrl || !/^https?:\/\//.test(returnUrl)) return jsonResponse({ error: "invalid_return_url" }, 400);

    const stripe = createStripeClient(environment);
    if (!/^[a-zA-Z0-9_-]+$/.test(user.id)) return jsonResponse({ error: "invalid_user_id" }, 400);

    const found = await stripe.customers.search({
      query: `metadata['userId']:'${user.id}'`,
      limit: 1,
    });
    const customerId = found.data[0]?.id;
    if (!customerId) return jsonResponse({ error: "no_customer" }, 404);

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return jsonResponse({ url: portal.url });
  } catch (e) {
    console.error("billing-customer-portal error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown_error" }, 500);
  }
});
