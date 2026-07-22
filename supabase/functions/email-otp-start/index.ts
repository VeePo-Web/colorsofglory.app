// Public edge function: starts a branded email-OTP flow (signup / login / reset).
// Sends the code via Resend through the Lovable Connector Gateway — never via
// the default Supabase/Lovable branded email templates.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { COG_SENDERS } from "../_shared/resend.ts";
import { otpCodeEmail } from "../_shared/email.ts";
import { sendAndLog } from "../_shared/sendAndLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM = Deno.env.get("EMAIL_OTP_FROM") ?? COG_SENDERS.security;
const APP_NAME = "Colors of Glory";

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
    const purpose = String(body.purpose ?? "login") as Purpose;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["signup", "login", "reset"].includes(purpose)) {
      return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const emailHash = await sha256Hex(email);
    const ipHash = await sha256Hex(req.headers.get("x-forwarded-for") ?? "unknown");

    // Velocity cap: max 5 codes per email per 15 minutes.
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await supabase
      .from("email_otp_verifications")
      .select("id", { count: "exact", head: true })
      .eq("email_hash", emailHash)
      .gte("created_at", since);
    if ((count ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // For signup: refuse if email already exists. For login/reset: refuse if no account.
    const { data: existingList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    const exists = existingList?.users?.some((u) => (u.email ?? "").toLowerCase() === email) ?? false;
    if (purpose === "signup" && exists) {
      return new Response(JSON.stringify({ error: "email_in_use" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // For login/reset: respond 200 even if missing (do not leak account existence).
    if ((purpose === "login" || purpose === "reset") && !exists) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256Hex(`${code}:${email}`);
    await supabase.from("email_otp_verifications").insert({
      email_hash: emailHash,
      code_hash: codeHash,
      purpose,
      ip_hash: ipHash,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });

    const rendered = otpCodeEmail({ code, purpose });
    const result = await sendAndLog({
      templateName: `otp_${purpose}`,
      category: "auth",
      recipientEmail: email,
      rendered,
      from: FROM,
      idempotencyKey: `otp:${purpose}:${emailHash}:${code}`,
      tags: [
        { name: "app", value: "cog" },
        { name: "category", value: "auth_otp" },
        { name: "purpose", value: purpose },
      ],
      meta: { source: "email-otp-start", purpose },
    }, supabase);
    if (!result.ok && result.status !== "duplicate") {
      return new Response(JSON.stringify({ error: "send_failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("email-otp-start error", e);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});