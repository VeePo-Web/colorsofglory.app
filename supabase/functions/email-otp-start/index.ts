// Public edge function: starts a branded email-OTP flow (signup / login / reset).
// Sends the code via Resend through the Lovable Connector Gateway — never via
// the default Supabase/Lovable branded email templates.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://connector-gateway.lovable.dev/resend";
const FROM = Deno.env.get("EMAIL_OTP_FROM") ?? "Colors of Glory <onboarding@resend.dev>";
const APP_NAME = "Colors of Glory";

type Purpose = "signup" | "login" | "reset";

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function emailBody(code: string, purpose: Purpose): { subject: string; html: string; text: string } {
  const verb = purpose === "signup" ? "Confirm your account" : purpose === "reset" ? "Reset your password" : "Sign in";
  const subject = `${code} — ${verb} · ${APP_NAME}`;
  const text =
    `Your ${APP_NAME} verification code is ${code}.\n\n` +
    `It expires in 10 minutes. If you didn't request this, you can ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F5F0E8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C1A17;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 16px;">
<tr><td align="center">
  <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#FAF7F2;border:1px solid rgba(28,26,23,.10);border-radius:16px;padding:32px;">
    <tr><td>
      <p style="margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6B6459;">${APP_NAME}</p>
      <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;color:#1C1A17;">${verb}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#1C1A17;">Enter this code to ${purpose === "signup" ? "finish creating your account" : purpose === "reset" ? "reset your password" : "sign in"}.</p>
      <div style="background:#F5F0E8;border:1px solid rgba(184,149,58,.40);border-radius:14px;padding:20px;text-align:center;margin:0 0 24px;">
        <span style="font-family:'SF Mono',Menlo,monospace;font-size:34px;letter-spacing:.4em;color:#1C1A17;font-weight:600;">${code}</span>
      </div>
      <p style="margin:0 0 4px;font-size:13px;color:#6B6459;">This code expires in 10 minutes.</p>
      <p style="margin:0;font-size:13px;color:#6B6459;">If you didn't request it, you can safely ignore this email.</p>
    </td></tr>
  </table>
  <p style="margin:16px 0 0;font-size:12px;color:#A09689;">© ${new Date().getFullYear()} ${APP_NAME}</p>
</td></tr></table>
</body></html>`;
  return { subject, html, text };
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "email_provider_unconfigured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    const { subject, html, text } = emailBody(code, purpose);
    const resp = await fetch(`${GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({ from: FROM, to: [email], subject, html, text }),
    });
    if (!resp.ok) {
      const detail = await resp.text();
      console.error("resend_send_failed", resp.status, detail);
      return new Response(JSON.stringify({ error: "send_failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("email-otp-start error", e);
    return new Response(JSON.stringify({ error: "internal" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});