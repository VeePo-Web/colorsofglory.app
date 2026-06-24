import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createStripeClient } from "../_shared/stripe.ts";

// Daily reconciliation: lists Stripe invoices paid in the last N hours and
// compares them against rows in public.billing_events (kind = invoice_paid).
// Inserts a reconciliation_reports row with any drifted invoice IDs and
// opens a fraud_flag of kind 'reconciliation_drift' when drift > 0.

const DEFAULT_WINDOW_HOURS = 48;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const windowHours = Number(new URL(req.url).searchParams.get("hours") ?? DEFAULT_WINDOW_HOURS);
  const sinceMs = Date.now() - windowHours * 3600 * 1000;
  const sinceSec = Math.floor(sinceMs / 1000);

  const envParam = new URL(req.url).searchParams.get("env");
  const env: "sandbox" | "live" = envParam === "live" ? "live" : "sandbox";

  let stripeInvoiceIds: string[] = [];
  try {
    const stripe = createStripeClient(env);
    let starting_after: string | undefined;
    for (let i = 0; i < 10; i++) {
      const page: any = await stripe.invoices.list({
        limit: 100,
        created: { gte: sinceSec },
        status: "paid",
        ...(starting_after && { starting_after }),
      });
      for (const inv of page.data) stripeInvoiceIds.push(inv.id);
      if (!page.has_more) break;
      starting_after = page.data[page.data.length - 1]?.id;
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: "stripe_list_failed", detail: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: localRows } = await supabase
    .from("billing_events")
    .select("external_id, kind, created_at")
    .eq("kind", "invoice_paid")
    .gte("created_at", new Date(sinceMs).toISOString());

  const localSet = new Set((localRows ?? []).map((r: any) => r.external_id).filter(Boolean));
  const drift = stripeInvoiceIds.filter((id) => !localSet.has(id));

  const { data: report } = await supabase
    .from("reconciliation_reports")
    .insert({
      window_hours: windowHours,
      stripe_invoice_count: stripeInvoiceIds.length,
      local_event_count: localSet.size,
      drift_count: drift.length,
      drift_invoice_ids: drift,
      notes: env,
    })
    .select()
    .single();

  if (drift.length > 0) {
    await supabase.from("fraud_flags").insert({
      subject_type: "reconciliation",
      subject_id: report?.id ?? null,
      reason: `reconciliation_drift:${drift.length} invoices missing in env=${env}`,
      severity: "high",
    });
  }

  return new Response(JSON.stringify({
    env,
    window_hours: windowHours,
    stripe_invoice_count: stripeInvoiceIds.length,
    local_event_count: localSet.size,
    drift_count: drift.length,
    report_id: report?.id,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});