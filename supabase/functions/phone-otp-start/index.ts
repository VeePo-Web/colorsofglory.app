// Public phone OTP send via Twilio Messaging. The Lovable connector gateway
// only routes the classic Twilio Account API (/2010-04-01/Accounts/{Sid}/...),
// so Twilio Verify v2 is NOT reachable through it. We mint our own 6-digit
// code, store only a hash + pepper, and send the SMS through Twilio Messages.
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

function genCode(): string {
  // Cryptographically random 6-digit code, no leading-zero bias.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 1_000_000).toString().padStart(6, "0");
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
    const FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");
    const OTP_PEPPER = Deno.env.get("OTP_PEPPER");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !FROM_NUMBER || !OTP_PEPPER) {
      console.error("phone-otp-start: missing env (need TWILIO_FROM_NUMBER + OTP_PEPPER)");
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

    // Mint code, hash with pepper, store pending row.
    const code = genCode();
    const codeHash = await sha256Hex(`${OTP_PEPPER}|${phone}|${code}`);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    // Invalidate any prior unconsumed codes for this phone — only one active code at a time.
    await admin.from("phone_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("phone_e164", phone)
      .is("consumed_at", null);

    const { data: otpRow, error: insErr } = await admin.from("phone_otps").insert({
      phone_e164: phone, code_hash: codeHash, expires_at: expiresAt,
      ip_hash: ipHash, country,
    }).select("id").single();
    if (insErr || !otpRow) {
      console.error("phone_otps insert failed", insErr);
      return json({ ok: false, code: "PROVIDER_ERROR" }, 500);
    }

    // Send SMS via Twilio Messages through Lovable connector gateway.
    const messageBody = `Your Colors of Glory code is ${code}. It expires in 10 minutes.`;
    const form = new URLSearchParams({ To: phone, From: FROM_NUMBER, Body: messageBody });
    const smsResp = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const smsJson = await smsResp.json().catch(() => ({}));

    if (!smsResp.ok) {
      console.error("twilio messages send failed", smsResp.status, smsJson);
      await admin.from("phone_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otpRow.id);
      await admin.from("phone_otp_verifications").insert({
        phone_e164: phone, ip_hash: ipHash, country, status: "send_failed",
        error_code: String((smsJson as { code?: number }).code ?? smsResp.status),
      });
      const tcode = (smsJson as { code?: number }).code;
      // 21211/21614 invalid To; 21408 permission to send to region; 21610 unsubscribed; 21612 unreachable carrier.
      if (tcode === 21211 || tcode === 21614) return json({ ok: false, code: "INVALID_PHONE" });
      if (tcode === 21408 || tcode === 21215) return json({ ok: false, code: "GEO_BLOCKED" });
      if (tcode === 20429 || smsResp.status === 429) return json({ ok: false, code: "RATE_LIMITED" });
      return json({ ok: false, code: "PROVIDER_ERROR" });
    }

    const sid = (smsJson as { sid?: string }).sid ?? null;
    await admin.from("phone_otps").update({ twilio_sid: sid }).eq("id", otpRow.id);
    await admin.from("phone_otp_verifications").insert({
      phone_e164: phone, ip_hash: ipHash, country, status: "sent", twilio_sid: sid,
    });
    return json({ ok: true });
  } catch (e) {
    console.error("phone-otp-start error", e);
    return json({ ok: false, code: "PROVIDER_ERROR" }, 500);
  }
});