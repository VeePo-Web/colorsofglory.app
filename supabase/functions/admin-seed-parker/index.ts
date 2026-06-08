import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const email = "parker@veepo.ca";
  const password = "Merlingrape101!!Merlingrape101!!Merlingrape101!!Merlingrape101!!";
  const phone = "+14038308930";

  // Find or create user
  let userId: string | null = null;
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) return json({ error: listErr.message }, 500);
  const existing = list.users.find((u) => u.email?.toLowerCase() === email);
  if (existing) {
    userId = existing.id;
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      phone,
      phone_confirm: true,
    });
    if (updErr) return json({ step: "update", error: updErr.message }, 500);
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      phone,
      phone_confirm: true,
    });
    if (createErr) return json({ step: "create", error: createErr.message }, 500);
    userId = created.user!.id;
  }

  // Grant admin role (idempotent)
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  if (roleErr) return json({ step: "role", error: roleErr.message }, 500);

  // Store hint
  const { error: hintErr } = await admin
    .from("app_settings")
    .upsert(
      {
        key: `admin_password_hint:${email}`,
        value: { hint: "MG101!! x 4" },
        description: "Memory aid only — not a secret.",
      },
      { onConflict: "key" },
    );
  if (hintErr) return json({ step: "hint", error: hintErr.message }, 500);

  return json({ ok: true, user_id: userId, email, role: "admin" });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}