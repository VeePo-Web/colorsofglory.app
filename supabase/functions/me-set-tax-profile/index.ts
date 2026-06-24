import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED_FORMS = new Set(["W-9", "W-8BEN", "W-8BEN-E", "other"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({} as any));
    const legal_name = String(body.legal_name ?? "").trim();
    const form_type = String(body.form_type ?? "").trim();
    const country = String(body.country ?? "").trim().toUpperCase();
    const tax_id_last4 = body.tax_id_last4 ? String(body.tax_id_last4).trim().slice(-4) : null;

    if (legal_name.length < 2 || legal_name.length > 200) return json({ error: "invalid_legal_name" }, 400);
    if (!ALLOWED_FORMS.has(form_type)) return json({ error: "invalid_form_type" }, 400);
    if (!/^[A-Z]{2}$/.test(country)) return json({ error: "invalid_country" }, 400);
    if (tax_id_last4 && !/^\d{4}$/.test(tax_id_last4)) return json({ error: "invalid_tax_id" }, 400);

    const { error } = await admin
      .from("payout_tax_profiles")
      .upsert(
        { user_id: user.id, legal_name, form_type, country, tax_id_last4, signed_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw error;
    return json({ ok: true });
  } catch (e) {
    console.error("me-set-tax-profile error", e);
    return json({ error: String(e) }, 500);
  }
});