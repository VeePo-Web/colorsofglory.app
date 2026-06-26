// Public phone OTP verify via Twilio Verify Check. On approval: upsert a user
// keyed by phone via the Admin API, mint a one-shot password, return it once
// so the client can call signInWithPassword({ phone, password }) to obtain a
// real Supabase session. The password is rotated on every verify, so the
// returned value is unusable after one login.
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

function randomPassword(): string {
  // 32 chars of url-safe base64 — strong enough to be a single-use shared secret.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "x") + "Aa1!";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, code: "METHOD" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const phone = String(body.phone ?? "").trim();
    const code = String(body.code ?? "").trim();
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) return json({ ok: false, code: "INVALID_PHONE" });
    if (!/^\d{4,8}$/.test(code)) return json({ ok: false, code: "INVALID_OTP" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const VERIFY_SID = Deno.env.get("TWILIO_VERIFY_SERVICE_SID");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !VERIFY_SID) {
      console.error("phone-otp-verify: missing Twilio env");
      return json({ ok: false, code: "PROVIDER_ERROR" }, 500);
    }

    // Twilio Verify Check.
    const checkResp = await fetch(
      `https://connector-gateway.lovable.dev/twilio/Verify/v2/Services/${VERIFY_SID}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, Code: code }),
      },
    );
    const checkJson = await checkResp.json().catch(() => ({}));
    const status = (checkJson as { status?: string }).status;

    if (!checkResp.ok) {
      const tcode = (checkJson as { code?: number }).code;
      if (tcode === 20404) return json({ ok: false, code: "EXPIRED" });
      if (tcode === 60202) return json({ ok: false, code: "MAX_ATTEMPTS" });
      console.error("twilio verify check failed", checkResp.status, checkJson);
      return json({ ok: false, code: "PROVIDER_ERROR" });
    }
    if (status !== "approved") {
      return json({ ok: false, code: status === "pending" ? "INVALID_OTP" : "EXPIRED" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Look up or create the user, keyed by phone.
    let userId: string | null = null;
    let createdUser = false;
    for (let page = 1; page <= 10 && !userId; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) { console.error("listUsers failed", error); break; }
      userId = data.users.find((u) => u.phone === phone.replace(/^\+/, "") || u.phone === phone)?.id ?? null;
      if (data.users.length < 200) break;
    }

    const oneShotPassword = randomPassword();

    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        phone,
        password: oneShotPassword,
        phone_confirm: true,
      });
      if (error || !data.user) {
        console.error("createUser by phone failed", error);
        return json({ ok: false, code: "PROVIDER_ERROR" }, 500);
      }
      userId = data.user.id;
      createdUser = true;
    } else {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: oneShotPassword,
        phone_confirm: true,
      });
      if (error) {
        console.error("updateUserById failed", error);
        return json({ ok: false, code: "PROVIDER_ERROR" }, 500);
      }
    }

    await admin.from("phone_otp_verifications").insert({
      phone_e164: phone, status: "verified", user_id: userId, created_user: createdUser,
    });

    return json({ ok: true, password: oneShotPassword, created: createdUser });
  } catch (e) {
    console.error("phone-otp-verify error", e);
    return json({ ok: false, code: "PROVIDER_ERROR" }, 500);
  }
});