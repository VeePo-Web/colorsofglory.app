// Public phone OTP send via Twilio Verify. Bypasses Supabase's native phone
// provider (which is OFF on Lovable Cloud and returns phone_provider_disabled).
// Mirrors the email-otp-start shape: validate, run otp-guard rails, call
// Twilio Verify through the Lovable connector gateway, log to audit table.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const phone = String(body.phone ?? "").trim();
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) return json({ ok: false, code: "INVALID_PHONE" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const VERIFY_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !VERIFY_SID) {
      console.error("phone-otp-start: missing Twilio env");
      return json({ ok: false, code: "PROVIDER_ERROR" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const ipHash = await sha256Hex(clientIp(req) + (Deno.env.get("OTP_IP_SALT") ?? "cog-otp-salt"));
    const country = phone.match(/^\+(\d{1,3})/)?.[1] ?? null;

    // Toll-fraud rails (fail-open on RPC error).
    try {
      const { data: guard } = await admin.rpc("check_and_record_otp_send", {
        _phone: phone, _ip_hash: ipHash, _country: country,
      });
      if (guard && (guard as { ok?: boolean }).ok === false) {
        const code = (guard as { code?: string }).code ?? "RATE_LIMITED";
        return json({ ok: false, code });
      }
    } catch (e) { console.warn("guard rpc failed (fail-open)", e); }

    // Twilio Verify start — via Lovable connector gateway.
    const formBody = new URLSearchParams({ To: phone, Channel: "sms" });
    const verifyResp = await fetch(
      `https://connector-gateway.lovable.dev/twilio/Verify/v2/Services/${VERIFY_SID}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody,
      },
    );
    const verifyJson = await verifyResp.json().catch(() => ({}));

    if (!verifyResp.ok) {
      console.error("twilio verify start failed", verifyResp.status, verifyJson);
      await admin.from("phone_otp_verifications").insert({
        phone_e164: phone, ip_hash: ipHash, country, status: "send_failed",
        error_code: String((verifyJson as { code?: number }).code ?? verifyResp.status),
      });
      const tcode = (verifyJson as { code?: number }).code;
      if (tcode === 60200 || tcode === 60033) return json({ ok: false, code: "INVALID_PHONE" });
      if (tcode === 60410 || tcode === 60203) return json({ ok: false, code: "RATE_LIMITED" });
      return json({ ok: false, code: "PROVIDER_ERROR" });
    }

    await admin.from("phone_otp_verifications").insert({
      phone_e164: phone, ip_hash: ipHash, country, status: "sent",
      twilio_sid: (verifyJson as { sid?: string }).sid ?? null,
    });
    return json({ ok: true });
  } catch (e) {
    console.error("phone-otp-start error", e);
    return json({ ok: false, code: "PROVIDER_ERROR" }, 500);
  }
});