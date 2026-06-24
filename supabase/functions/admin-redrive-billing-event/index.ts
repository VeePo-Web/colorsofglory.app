import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Admin-only re-drive of a stored billing_event. Re-runs the SAME idempotent
// money RPCs the payments-webhook uses (record_invoice_paid / _refunded /
// record_chargeback), derived from the stored Stripe payload. Idempotent: the
// underlying RPCs no-op on replay. Does NOT touch the live webhook.
//
// Supported kinds: invoice_paid, invoice_refunded, chargeback_created.
// Subscription/plan events must be re-triggered from Stripe (they need a live
// API re-fetch) — this returns {error:'unsupported_kind'} for those.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return j({ error: "unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return j({ error: "unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return j({ error: "forbidden" }, 403);

    const { id } = await req.json().catch(() => ({ id: null }));
    if (!id) return j({ error: "missing_id" }, 400);

    const { data: row, error: rowErr } = await admin
      .from("billing_events")
      .select("external_event_id, kind, payload")
      .eq("id", id)
      .maybeSingle();
    if (rowErr || !row) return j({ error: "event_not_found" }, 404);

    const event = (row.payload as { data?: { object?: Record<string, unknown> } }) ?? {};
    const obj = (event.data?.object ?? {}) as Record<string, any>;
    const kind = String(row.kind);

    if (kind === "invoice_paid") {
      const subExternal: string | null =
        obj?.parent?.subscription_details?.subscription ??
        obj?.subscription ??
        obj?.lines?.data?.[0]?.subscription ??
        null;
      if (!subExternal) return j({ error: "no_subscription_on_invoice" }, 422);
      const { data: sub } = await admin
        .from("subscriptions").select("id, user_id").eq("external_id", subExternal).maybeSingle();
      if (!sub) return j({ error: "subscription_row_not_found" }, 422);
      await admin.rpc("record_invoice_paid", {
        _event: {
          user_id: sub.user_id,
          invoice_external_id: obj.id,
          subscription_id: sub.id,
          amount_cents: obj.amount_paid ?? 0,
          currency: (obj.currency ?? "cad").toLowerCase(),
        },
      });
    } else if (kind === "invoice_refunded") {
      await admin.rpc("record_invoice_refunded", {
        _event: {
          invoice_external_id: obj.invoice ?? obj.payment_intent ?? obj.id,
          amount_cents: obj.amount_refunded ?? obj.amount ?? 0,
        },
      });
    } else if (kind === "chargeback_created") {
      await admin.rpc("record_chargeback", {
        _event: {
          invoice_external_id: obj.invoice ?? obj.payment_intent ?? obj.id,
          amount_cents: obj.amount ?? 0,
        },
      });
    } else {
      return j({ error: "unsupported_kind", kind }, 422);
    }

    await admin.from("billing_events")
      .update({ processed_at: new Date().toISOString(), processing_error: null })
      .eq("external_event_id", row.external_event_id);

    return j({ ok: true, kind });
  } catch (e) {
    return j({ error: String(e) }, 500);
  }
});
