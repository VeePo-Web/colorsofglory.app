import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  method: z.enum(["manual", "paypal", "stripe_connect"]),
  email: z.string().trim().email().max(255).optional().nullable(),
  country: z.string().trim().min(2).max(2).optional().nullable(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

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

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

  const { method, email, country } = parsed.data;
  if ((method === "paypal" || method === "manual") && !email) {
    return json({ error: { email: ["Email required for this method"] } }, 400);
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      payout_method: method,
      payout_email: email ?? null,
      payout_country: country ? country.toUpperCase() : null,
    })
    .eq("user_id", user.id);
  if (error) return json({ error: String(error) }, 500);

  return json({ ok: true });
});