import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SHARE_BASE = "https://colorsofglory.app/r/";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userRes } = await supabase.auth.getUser(token);
  const user = userRes.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("payout_method, payout_email, payout_country")
      .eq("user_id", user.id)
      .maybeSingle();
    const payout_method_complete = !!profile?.payout_method;

    const { data: founder } = await supabase
      .from("founders")
      .select("id, display_name, status, user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!founder) return json({ is_founder: false, payout_method_complete }, 200);

    // Founder code (one active code per founder; pick most recent active)
    const { data: codes } = await supabase
      .from("codes")
      .select("id, value, max_redemptions, redemption_count, expires_at, status")
      .eq("owner_founder_id", founder.id)
      .eq("kind", "founder")
      .order("created_at", { ascending: false });
    const activeCode = (codes ?? []).find((c: any) => c.status === "active") ?? null;

    // Attributed users for this founder
    const { data: attrs } = await supabase
      .from("referral_attributions")
      .select("referred_user_id, created_at")
      .eq("referrer_type", "founder")
      .eq("referrer_founder_id", founder.id);
    const referredIds = (attrs ?? []).map((a: any) => a.referred_user_id);

    // Currently-paying among them (drives MRR)
    let payingCount = 0;
    if (referredIds.length > 0) {
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("user_id, status, current_period_end, plan")
        .in("user_id", referredIds)
        .in("plan", ["pro", "founder_pro"]);
      const nowMs = Date.now();
      for (const s of subs ?? []) {
        const okStatus = ["active", "trialing", "past_due"].includes(s.status as string);
        const future = !s.current_period_end
          || new Date(s.current_period_end as string).getTime() > nowMs;
        if (okStatus && future) payingCount++;
      }
    }

    // Earnings
    const { data: rewards } = await supabase
      .from("reward_events")
      .select("amount_cents, status, created_at, paid_month_index, invoice_external_id")
      .eq("referrer_type", "founder")
      .eq("referrer_founder_id", founder.id)
      .eq("reward_kind", "cash");
    const sum = (s: string) =>
      (rewards ?? []).filter((r: any) => r.status === s).reduce((a: number, r: any) => a + (r.amount_cents ?? 0), 0);
    const pending_cents = sum("pending");
    const payable_cents = sum("payable");
    const paid_cents = sum("paid");
    const lifetime_cents = pending_cents + payable_cents + paid_cents;

    // Next draft date — pg_cron `cog-create-payout-drafts-monthly` runs at
    // 07:25 UTC on day 1 of each month.
    const now = new Date();
    const nextDraft = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 7, 25));

    // Recent paid invoices (most recent 10)
    const recent_paid_invoices = (rewards ?? [])
      .filter((r: any) => r.status === "paid" || r.status === "payable")
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((r: any) => ({
        invoice_external_id: r.invoice_external_id,
        amount_cents: r.amount_cents,
        month_index: r.paid_month_index,
        status: r.status,
        created_at: r.created_at,
      }));

    const event_timeline = (rewards ?? [])
      .slice()
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50)
      .map((r: any) => ({
        status: r.status,
        amount_cents: r.amount_cents,
        invoice_external_id: r.invoice_external_id,
        created_at: r.created_at,
      }));

    return json({
      is_founder: true,
      payout_method_complete,
      payout_method: profile?.payout_method ?? null,
      display_name: founder.display_name,
      status: founder.status,
      code: activeCode?.value ?? null,
      share_link: activeCode?.value ? `${SHARE_BASE}${activeCode.value}` : null,
      redemptions_used: activeCode?.redemption_count ?? 0,
      redemptions_cap: activeCode?.max_redemptions ?? null,
      code_expires_at: activeCode?.expires_at ?? null,
      attributed_count: referredIds.length,
      paying_count: payingCount,
      earnings: { pending_cents, payable_cents, paid_cents, lifetime_cents },
      next_payout_estimate_cents: payable_cents,
      next_draft_date: nextDraft.toISOString(),
      recent_paid_invoices,
      event_timeline,
    });
  } catch (e) {
    console.error("me-founder-stats error", e);
    return json({ error: String(e) }, 500);
  }
});