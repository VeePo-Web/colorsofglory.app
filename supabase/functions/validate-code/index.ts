import { adminClient, corsHeaders, jsonResponse, resolveUser } from "../_shared/auth.ts";

// Validates a code at checkout time. Returns the routing decision
// the create-checkout function will use. Read-only.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const user = await resolveUser(req);
    if (!user) return jsonResponse({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({} as any));
    const code: string = (body.code ?? "").toString().trim().toUpperCase();
    const planKey: string = (body.plan_key ?? "pro").toString();

    if (!code) return jsonResponse({ kind: "invalid", reason: "not_found" });
    if (planKey !== "pro") return jsonResponse({ kind: "invalid", reason: "wrong_plan" });

    const admin = adminClient();

    // 1) Already has an attribution? Single-code-per-buyer rule.
    const { data: existingAttr } = await admin
      .from("referral_attributions")
      .select("id")
      .eq("referred_user_id", user.id)
      .maybeSingle();
    if (existingAttr) {
      return jsonResponse({ kind: "invalid", reason: "already_attributed" });
    }

    // 2) Try as founder code (codes table, kind=founder, owner_founder_id set, active).
    const { data: founderCode } = await admin
      .from("codes")
      .select("id, owner_founder_id, kind, status, expires_at, max_redemptions, redemption_count")
      .eq("value", code)
      .eq("kind", "founder")
      .maybeSingle();

    if (founderCode && founderCode.owner_founder_id) {
      if (founderCode.status !== "active") return jsonResponse({ kind: "invalid", reason: "expired" });
      if (founderCode.expires_at && new Date(founderCode.expires_at) <= new Date()) {
        return jsonResponse({ kind: "invalid", reason: "expired" });
      }
      if (
        founderCode.max_redemptions !== null &&
        founderCode.redemption_count >= founderCode.max_redemptions
      ) {
        return jsonResponse({ kind: "invalid", reason: "expired" });
      }

      const { data: founder } = await admin
        .from("founders")
        .select("id, display_name, user_id, status")
        .eq("id", founderCode.owner_founder_id)
        .maybeSingle();
      if (!founder || founder.status !== "active") {
        return jsonResponse({ kind: "invalid", reason: "expired" });
      }
      if (founder.user_id === user.id) {
        return jsonResponse({ kind: "invalid", reason: "self" });
      }

      return jsonResponse({
        kind: "founder",
        discount_pct: 50,
        effective_cents: 4900,
        founder_display_name: founder.display_name,
        code_id: founderCode.id,
      });
    }

    // 3) Try as member referral_code on profiles.
    const { data: referrer } = await admin
      .from("profiles")
      .select("user_id, display_name, first_name")
      .eq("referral_code", code)
      .maybeSingle();

    if (referrer) {
      if (referrer.user_id === user.id) {
        return jsonResponse({ kind: "invalid", reason: "self" });
      }
      return jsonResponse({
        kind: "member_referral",
        referrer_display_name: referrer.display_name ?? referrer.first_name ?? "A fellow songwriter",
        referrer_user_id: referrer.user_id,
      });
    }

    return jsonResponse({ kind: "invalid", reason: "not_found" });
  } catch (e) {
    console.error("validate-code error", e);
    return jsonResponse({ kind: "invalid", reason: "not_found" }, 200);
  }
});