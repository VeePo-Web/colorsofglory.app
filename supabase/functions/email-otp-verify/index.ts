// Public edge function: verifies a 6-digit code and finishes the auth action.
// - signup: creates the user with email_confirm=true and the password supplied.
// - reset:  updates the existing user's password.
// - login:  no-op (caller proceeds with signInWithPassword on the client).
// In all cases the caller follows up with `supabase.auth.signInWithPassword` to
// mint a session — no Lovable/Supabase branded magic-link emails are ever sent.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Purpose = "signup" | "login" | "reset";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const code = String(body.code ?? "").trim();
    const purpose = String(body.purpose ?? "login") as Purpose;
    const password = typeof body.password === "string" ? body.password : "";
    const firstName = typeof body.firstName === "string" ? body.firstName : null;
    const lastName = typeof body.lastName === "string" ? body.lastName : null;

    if (!email || !/^\d{6}$/.test(code) || !["signup", "login", "reset"].includes(purpose)) {
      return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if ((purpose === "signup" || purpose === "reset") && password.length < 8) {
      return new Response(JSON.stringify({ error: "weak_password" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const emailHash = await sha256Hex(email);
    const codeHash = await sha256Hex(`${code}:${email}`);

    // Pull latest matching unused, unexpired row for this email+purpose.
    const { data: row } = await supabase
      .from("email_otp_verifications")
      .select("id, code_hash, attempts, expires_at, used_at")
      .eq("email_hash", emailHash)
      .eq("purpose", purpose)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) {
      return new Response(JSON.stringify({ error: "invalid_or_expired" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (row.attempts >= 5) {
      return new Response(JSON.stringify({ error: "too_many_attempts" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (row.code_hash !== codeHash) {
      await supabase.from("email_otp_verifications").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return new Response(JSON.stringify({ error: "invalid_code", remaining: Math.max(0, 5 - (row.attempts + 1)) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mark used immediately to make replay impossible.
    await supabase.from("email_otp_verifications").update({ used_at: new Date().toISOString() }).eq("id", row.id);

    if (purpose === "signup") {
      const { error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
      });
      if (error) {
        const msg = error.message?.toLowerCase() ?? "";
        if (msg.includes("already") || msg.includes("registered")) {
          return new Response(JSON.stringify({ error: "email_in_use" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        console.error("createUser failed", error);
        return new Response(JSON.stringify({ error: "create_failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (purpose === "reset") {
      // Find user id by email (Supabase admin has no direct lookup; iterate paged).
      let userId: string | null = null;
      for (let page = 1; page <= 5 && !userId; page++) {
        const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        userId = data?.users?.find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
        if (!data || data.users.length < 200) break;
      }
      if (!userId) {
        return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await supabase.auth.admin.updateUserById(userId, { password });
      if (error) {
        console.error("updateUserById failed", error);
        return new Response(JSON.stringify({ error: "update_failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    // login: nothing to do server-side.

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("email-otp-verify error", e);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});