import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Phone OTP toll-fraud guard. Anon-invokable (login happens pre-auth).
// Derives the client IP server-side (never trust the client), hashes it with a
// salt, derives the dial country, and asks check_and_record_otp_send() whether
// this send is allowed. Returns the RPC decision verbatim, or {ok:false,
// code:'GUARD_ERROR'} on internal failure — the SDK treats GUARD_ERROR as
// fail-open so a guard bug never locks users out of login.

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

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function countryFromE164(phone: string): string | null {
  const m = phone.match(/^\+(\d{1,3})/);
  return m ? m[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD" }, 405);

  try {
    const { phone } = await req.json().catch(() => ({ phone: null }));
    if (!phone || typeof phone !== "string") return json({ ok: false, code: "INVALID_PHONE" });

    const salt = Deno.env.get("OTP_IP_SALT") ?? "cog-otp-salt";
    const ipHash = await sha256(clientIp(req) + salt);
    const country = countryFromE164(phone);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await admin.rpc("check_and_record_otp_send", {
      _phone: phone,
      _ip_hash: ipHash,
      _country: country,
    });
    if (error) {
      console.error("otp-guard rpc error", error.message);
      return json({ ok: false, code: "GUARD_ERROR" }); // fail-open downstream
    }
    return json(data);
  } catch (e) {
    console.error("otp-guard error", e);
    return json({ ok: false, code: "GUARD_ERROR" }); // fail-open downstream
  }
});
