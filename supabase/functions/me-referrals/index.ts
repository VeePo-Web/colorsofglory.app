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
      .select("referral_code, payout_method, payout_email, payout_country")
      .eq("user_id", user.id)
      .maybeSingle();

    const code = profile?.referral_code ?? null;
    const link = code ? `${SHARE_BASE}${code}` : null;

    // All referred users for this referrer
    const { data: attrs } = await supabase
      .from("referral_attributions")
      .select("referred_user_id, created_at")
      .eq("referrer_type", "user")
      .eq("referrer_user_id", user.id);

    const referredIds = (attrs ?? []).map((a: any) => a.referred_user_id);

    // Currently-paying set among those users — single source of truth: the
    // subscriptions table. Only active/trialing/past_due on pro/founder_pro
    // with a future (or null) current_period_end count as "paying right now".
    const payingSet = new Set<string>();
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
        if (okStatus && future) payingSet.add(s.user_id as string);
      }
    }
    const payingCount = payingSet.size;

    // Reward totals for this referrer
    const { data: rewards } = await supabase
      .from("reward_events")
      .select("amount_cents, status, reward_kind, referred_user_id")
      .eq("referrer_type", "user")
      .eq("referrer_user_id", user.id)
      .eq("reward_kind", "cash");

    const sum = (s: string) =>
      (rewards ?? []).filter((r: any) => r.status === s).reduce((a: number, r: any) => a + (r.amount_cents ?? 0), 0);
    const pending_cents = sum("pending");
    const payable_cents = sum("payable");
    const paid_cents = sum("paid");
    const lifetime_cents = pending_cents + payable_cents + paid_cents;

    // Per-referral aggregate
    const earnedByUser = new Map<string, number>();
    for (const r of rewards ?? []) {
      if (r.status === "reversed") continue;
      earnedByUser.set(
        r.referred_user_id as string,
        (earnedByUser.get(r.referred_user_id as string) ?? 0) + (r.amount_cents ?? 0),
      );
    }

    const recent_referrals = (attrs ?? [])
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 25)
      .map((a: any) => {
        const earned = earnedByUser.get(a.referred_user_id) ?? 0;
        return {
          referred_at: a.created_at,
          // Real-time signal from the subscriptions table — not "ever paid".
          is_paying: payingSet.has(a.referred_user_id),
          has_paid_before: earned > 0,
          total_earned_cents: earned,
        };
      });

    // $5/mo per currently-paying referral = the user's referral MRR
    const { data: settingRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "user_referral_cash_cents")
      .maybeSingle();
    const perReferralCents = Number(settingRow?.value ?? 500) || 500;
    const monthly_recurring_cents = payingCount * perReferralCents;

    // Referee-side benefit + a prefilled, on-brand share message so every
    // surface can ship identical one-tap sharing (referral-UX audit P0 #1/#2).
    const referee_benefit = "Your first song is free";
    const share_message = link
      ? `Come write with me on Colors of Glory — every lyric, voice memo, and chord for a song stays in one place. ${referee_benefit} when you start here: ${link}`
      : null;

    return json({
      code,
      link,
      share_message,
      referee_benefit,
      attributed_count: referredIds.length,
      paying_count: payingCount,
      per_referral_cents: perReferralCents,
      monthly_recurring_cents,
      earnings: { pending_cents, payable_cents, paid_cents, lifetime_cents },
      next_payout_estimate_cents: payable_cents,
      recent_referrals,
      payout_method: {
        kind: profile?.payout_method ?? null,
        email: profile?.payout_email ?? null,
        country: profile?.payout_country ?? null,
      },
    });
  } catch (e) {
    console.error("me-referrals error", e);
    return json({ error: String(e) }, 500);
  }
});