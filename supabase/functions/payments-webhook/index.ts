import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  bytesForStorageLookupKey,
  createStripeClient,
  defaultUnitAmountForPlan,
  isStorageLookupKey,
  planForLookupKey,
  verifyWebhook,
} from "../_shared/stripe.ts";

// Service-role client; webhooks are not user-scoped.
let _supabase: ReturnType<typeof createClient> | null = null;
function db() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

function lookupKeyFromSubscription(sub: any): string | null {
  const item = sub?.items?.data?.[0];
  return (
    item?.price?.lookup_key ||
    sub?.metadata?.lookup_key ||
    null
  );
}

function userIdFromSubscription(sub: any, customer: any | null): string | null {
  return (
    sub?.metadata?.userId ||
    customer?.metadata?.userId ||
    null
  );
}

function periodFromSubscription(sub: any): { start: string | null; end: string | null } {
  const item = sub?.items?.data?.[0];
  const start = item?.current_period_start ?? sub?.current_period_start;
  const end = item?.current_period_end ?? sub?.current_period_end;
  return {
    start: start ? new Date(start * 1000).toISOString() : null,
    end: end ? new Date(end * 1000).toISOString() : null,
  };
}

async function recordBillingEvent(eventId: string, kind: string, userId: string | null, amountCents: number, currency: string, payload: unknown) {
  await db().from("billing_events").insert({
    kind,
    external_event_id: eventId,
    user_id: userId,
    amount_cents: amountCents,
    currency,
    payload,
  });
}

async function markBillingEventProcessed(eventId: string, error?: string) {
  await db().from("billing_events")
    .update({
      processed_at: error ? null : new Date().toISOString(),
      processing_error: error ?? null,
    })
    .eq("external_event_id", eventId);
}

async function upsertSubscription(sub: any, stripe: ReturnType<typeof createStripeClient>) {
  let customer: any = null;
  if (sub.customer && typeof sub.customer === "string") {
    customer = await stripe.customers.retrieve(sub.customer).catch(() => null);
  }
  const userId = userIdFromSubscription(sub, customer);
  if (!userId) {
    console.warn("subscription event without resolvable userId", sub.id);
    return;
  }
  const lookupKey = lookupKeyFromSubscription(sub);

  // Storage add-ons live in their own table and never affect plan/quota math
  // beyond the bytes they grant.
  if (isStorageLookupKey(lookupKey)) {
    await upsertStorageAddon(sub, userId, lookupKey);
    return;
  }

  const plan = planForLookupKey(lookupKey);
  const { start, end } = periodFromSubscription(sub);
  const item = sub.items?.data?.[0];
  const unitAmount = item?.price?.unit_amount ?? defaultUnitAmountForPlan(plan);
  const currency = item?.price?.currency ?? "cad";

  await db().from("subscriptions").upsert(
    {
      user_id: userId,
      external_id: sub.id,
      plan,
      unit_amount_cents: unitAmount,
      currency,
      status: sub.status,
      current_period_start: start,
      current_period_end: end,
      cancelled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "external_id" },
  );
}

async function upsertStorageAddon(sub: any, userId: string, lookupKey: string | null) {
  const { start, end } = periodFromSubscription(sub);
  const bytes = bytesForStorageLookupKey(lookupKey);
  await db().from("storage_addons").upsert(
    {
      user_id: userId,
      external_id: sub.id,
      lookup_key: lookupKey ?? "",
      bytes_granted: bytes,
      status: sub.status,
      current_period_start: start,
      current_period_end: end,
      cancelled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "external_id" },
  );
}

async function handleInvoicePaid(invoice: any) {
  const subscriptionExternal = invoice.subscription ?? null;
  const userId = invoice.metadata?.userId
    ?? invoice.subscription_details?.metadata?.userId
    ?? null;

  let subRowId: string | null = null;
  if (subscriptionExternal) {
    const { data } = await db()
      .from("subscriptions")
      .select("id, user_id")
      .eq("external_id", subscriptionExternal)
      .maybeSingle();
    subRowId = data?.id ?? null;

    // Storage-addon invoices never produce referral rewards.
    if (!subRowId) {
      const { data: addon } = await db()
        .from("storage_addons")
        .select("id")
        .eq("external_id", subscriptionExternal)
        .maybeSingle();
      if (addon) return;
    }
  }

  const effectiveUser = userId
    ?? (subRowId
      ? (await db().from("subscriptions").select("user_id").eq("id", subRowId).maybeSingle()).data?.user_id
      : null);

  if (!effectiveUser) {
    console.warn("invoice.paid without resolvable user", invoice.id);
    return;
  }

  await db().rpc("record_invoice_paid", {
    _event: {
      user_id: effectiveUser,
      invoice_external_id: invoice.id,
      subscription_id: subRowId,
      amount_cents: invoice.amount_paid ?? invoice.amount_due ?? 0,
      currency: invoice.currency ?? "cad",
    },
  });
}

async function handleInvoiceRefunded(invoice: any) {
  await db().rpc("record_invoice_refunded", {
    _event: {
      invoice_external_id: invoice.id,
      amount_cents: invoice.amount_refunded ?? invoice.amount ?? 0,
    },
  });
}

async function handleChargeback(charge: any) {
  await db().rpc("record_chargeback", {
    _event: {
      invoice_external_id: charge.invoice ?? charge.payment_intent ?? charge.id,
      amount_cents: charge.amount ?? 0,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("invalid env query param", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;

  let event: { type: string; data: { object: any }; id: string };
  try {
    event = await verifyWebhook(req, env);
  } catch (e) {
    console.error("webhook verify failed", e);
    return new Response("invalid_signature", { status: 400 });
  }

  // Idempotency: bail early if event already processed.
  const { data: existing } = await db()
    .from("billing_events")
    .select("id, processed_at")
    .eq("external_event_id", event.id)
    .maybeSingle();
  if (existing?.processed_at) {
    return ok();
  }

  const stripe = createStripeClient(env);
  const obj = event.data.object;
  const kindMap: Record<string, string> = {
    "checkout.session.completed": "checkout_completed",
    "customer.subscription.created": "subscription_created",
    "customer.subscription.updated": "subscription_updated",
    "customer.subscription.deleted": "subscription_cancelled",
    "invoice.paid": "invoice_paid",
    "invoice.payment_succeeded": "invoice_paid",
    "invoice.payment_failed": "invoice_payment_failed",
    "charge.refunded": "invoice_refunded",
    "charge.dispute.created": "chargeback_created",
  };
  const kind = kindMap[event.type] ?? event.type;

  await recordBillingEvent(
    event.id,
    kind,
    obj?.metadata?.userId ?? null,
    obj?.amount_paid ?? obj?.amount ?? obj?.amount_total ?? 0,
    obj?.currency ?? "cad",
    event,
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // If it created a subscription, fetch + upsert it now so the user
        // sees Pro immediately even before the subscription.* events arrive.
        if (obj.mode === "subscription" && obj.subscription) {
          const sub = await stripe.subscriptions.retrieve(obj.subscription, {
            expand: ["items.data.price"],
          });
          await upsertSubscription(sub, stripe);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertSubscription(obj, stripe);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        await handleInvoicePaid(obj);
        break;
      }
      case "charge.refunded": {
        await handleInvoiceRefunded(obj);
        break;
      }
      case "charge.dispute.created": {
        await handleChargeback(obj);
        break;
      }
      default:
        console.log("unhandled event", event.type);
    }
    await markBillingEventProcessed(event.id);
  } catch (e) {
    console.error("webhook handler error", event.type, e);
    await markBillingEventProcessed(event.id, String(e));
    return new Response("handler_error", { status: 500 });
  }

  return ok();
});

function ok() {
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}