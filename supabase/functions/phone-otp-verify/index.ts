// Public phone OTP verify. Reads the pending phone_otps row, compares the
// peppered hash, enforces expiry + max-attempts, then upserts a user keyed by
// phone via the Admin API and returns a one-shot password the client uses to
// mint a real Supabase session via signInWithPassword({phone,password}).
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

function randomPassword(): string {
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
    const OTP_PEPPER = Deno.env.get("OTP_PEPPER");
    if (!OTP_PEPPER) {
      console.error("phone-otp-verify: missing OTP_PEPPER");
      return json({ ok: false, code: "PROVIDER_ERROR" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: otp, error: otpErr } = await admin
      .from("phone_otps")
      .select("id, code_hash, expires_at, attempts, max_attempts, consumed_at")
      .eq("phone_e164", phone)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (otpErr) {
      console.error("phone_otps lookup failed", otpErr);
      return json({ ok: false, code: "PROVIDER_ERROR" }, 500);
    }
    if (!otp) return json({ ok: false, code: "EXPIRED" });
    if (new Date(otp.expires_at as string).getTime() < Date.now()) {
      await admin.from("phone_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
      return json({ ok: false, code: "EXPIRED" });
    }
    if ((otp.attempts as number) >= (otp.max_attempts as number)) {
      await admin.from("phone_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
      return json({ ok: false, code: "MAX_ATTEMPTS" });
    }

    const submittedHash = await sha256Hex(`${OTP_PEPPER}|${phone}|${code}`);
    if (submittedHash !== otp.code_hash) {
      const nextAttempts = (otp.attempts as number) + 1;
      await admin.from("phone_otps").update({ attempts: nextAttempts }).eq("id", otp.id);
      const remaining = (otp.max_attempts as number) - nextAttempts;
      return json({ ok: false, code: remaining <= 0 ? "MAX_ATTEMPTS" : "INVALID_OTP" });
    }

    // Burn the code immediately.
    await admin.from("phone_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);

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
        phone, password: oneShotPassword, phone_confirm: true,
      });
      if (error || !data.user) {
        console.error("createUser by phone failed", error);
        return json({ ok: false, code: "PROVIDER_ERROR" }, 500);
      }
      userId = data.user.id;
      createdUser = true;
    } else {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: oneShotPassword, phone_confirm: true,
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