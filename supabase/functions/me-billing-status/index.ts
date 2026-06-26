import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Plan = "free" | "starter" | "pro" | "founder_pro";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function emptyResponse(authenticated: boolean) {
  return {
    authenticated,
    user_id: null,
    plan: "free" as Plan,
    is_pro: false,
    subscription: null,
    storage: {
      used_bytes: 0,
      included_bytes: 0,
      addon_bytes: 0,
      limit_bytes: 0,
      pct_used: 0,
    },
    addons: [] as Array<unknown>,
    song_quota: { owned_limit: 1, can_create_song: true },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(emptyResponse(false));

  const { data: userRes } = await supabase.auth.getUser(token);
  const user = userRes.user;
  if (!user) return json(emptyResponse(false));

  try {
    const [
      planRes,
      isProRes,
      limitRes,
      canCreateRes,
      subRes,
      addonsRes,
      usageRes,
      tiersRes,
    ] = await Promise.all([
      supabase.rpc("current_plan", { _user_id: user.id }),
      supabase.rpc("is_pro_user", { _user_id: user.id }),
      supabase.rpc("effective_storage_limit", { _user_id: user.id }),
      supabase.rpc("can_create_song", { _user_id: user.id }),
      supabase
        .from("subscriptions")
        .select("id, plan, status, current_period_end, cancelled_at, unit_amount_cents, currency")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("storage_addons")
        .select("id, bytes_granted, status, current_period_end")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing", "past_due"]),
      supabase.from("storage_usage").select("bytes_used").eq("user_id", user.id).maybeSingle(),
      supabase.from("plan_tiers").select("key, owned_song_limit, storage_bytes_included"),
    ]);

    const plan = (planRes.data as Plan) ?? "free";
    const planTier =
      (tiersRes.data ?? []).find((t: any) => t.key === (plan === "founder_pro" ? "pro" : plan)) ??
      (tiersRes.data ?? []).find((t: any) => t.key === "free");

    const includedBytes = Number(planTier?.storage_bytes_included ?? 0);
    const ownedLimit = Number(planTier?.owned_song_limit ?? 1);
    const limitBytes = Number(limitRes.data ?? includedBytes);
    const addons = (addonsRes.data ?? []) as any[];
    const addonBytes = addons.reduce((sum, a) => sum + Number(a.bytes_granted ?? 0), 0);
    const usedBytes = Number((usageRes.data as any)?.bytes_used ?? 0);
    const pctUsed = limitBytes > 0 ? Math.min(1, Math.max(0, usedBytes / limitBytes)) : 0;

    const sub = subRes.data as any | null;
    const subscription = sub
      ? {
          id: sub.id,
          plan: sub.plan as Plan,
          status: sub.status as string,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: !!sub.cancelled_at && sub.status !== "canceled",
          cancelled_at: sub.cancelled_at,
          unit_amount_cents: Number(sub.unit_amount_cents ?? 0),
          currency: sub.currency ?? "cad",
        }
      : null;

    return json({
      authenticated: true,
      user_id: user.id,
      plan,
      is_pro: !!isProRes.data,
      subscription,
      storage: {
        used_bytes: usedBytes,
        included_bytes: includedBytes,
        addon_bytes: addonBytes,
        limit_bytes: limitBytes,
        pct_used: pctUsed,
      },
      addons: addons.map((a) => ({
        id: a.id,
        bytes: Number(a.bytes_granted ?? 0),
        status: a.status,
        current_period_end: a.current_period_end,
      })),
      song_quota: {
        owned_limit: ownedLimit,
        can_create_song: canCreateRes.data !== false,
      },
    });
  } catch (e) {
    console.error("me-billing-status error", e);
    return json({ error: String(e) }, 500);
  }
});