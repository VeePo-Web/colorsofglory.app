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
    const subscriptionId: string | undefined = body.subscription_id;
    const atPeriodEnd: boolean = body.at_period_end !== false; // default true (grace period)

    const admin = adminClient();

    // Resolve target subscription — caller-supplied id must belong to caller; otherwise pick latest active.
    let externalId: string | null = null;
    if (typeof subscriptionId === "string") {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("external_id, user_id")
        .eq("id", subscriptionId)
        .maybeSingle();
      if (!sub || sub.user_id !== user.id) return jsonResponse({ error: "forbidden" }, 403);
      externalId = sub.external_id;
    } else {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("external_id")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing", "past_due"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      externalId = sub?.external_id ?? null;
    }
    if (!externalId) return jsonResponse({ error: "no_active_subscription" }, 404);

    const stripe = createStripeClient(environment);
    const updated = atPeriodEnd
      ? await stripe.subscriptions.update(externalId, { cancel_at_period_end: true })
      : await stripe.subscriptions.cancel(externalId);

    await admin.from("audit_logs").insert({
      actor_user_id: user.id,
      action: atPeriodEnd ? "cancel_subscription_at_period_end" : "cancel_subscription_immediately",
      entity_type: "subscription",
      entity_id: null,
      after: { external_id: externalId, status: updated.status, cancel_at_period_end: updated.cancel_at_period_end },
    });

    return jsonResponse({ ok: true, external_id: externalId, status: updated.status, cancel_at_period_end: updated.cancel_at_period_end });
  } catch (e) {
    console.error("billing-cancel-subscription error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "unknown_error" }, 500);
  }
});
